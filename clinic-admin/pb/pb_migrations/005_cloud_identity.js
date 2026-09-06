// clinic-admin/pb/pb_migrations/005_cloud_identity.js
//
// SHARED IDENTITY (step A of the single-clinic instance). Until now every device made its own
// workspace (own random master key, own PIN keyring in localStorage), so two devices never saw
// each other's board or users. This migration moves the KEYRING to the server:
//
//   workspace  (base)  — exactly one row, slug "default": clinic name, the shared PBKDF2 salt
//                        every PIN-derived password uses, the public user DIRECTORY
//                        [{ id, staffId, name, role }] that the lock screen shows BEFORE login,
//                        and the `bootstrapped` flag that gates POST /api/clinic/bootstrap.
//                        Rules: list/view "" (public read — the dropdown must work before login;
//                        the privacy panel discloses that names + roles are visible to anyone
//                        with the URL). create/update/delete null → only the hook (superuser
//                        context, $app.save) writes it.
//   staff_users (auth) — one record per login: name · role · staffId · mustChangePin. password =
//                        bcrypt(base64(PBKDF2-SHA256(PIN, workspace.salt, 310k))) — the PIN itself
//                        never reaches the server. `mustChangePin` forces a new PIN after a temp PIN.
//                        Identity = synthetic email "<recordId>@clinic.local" (the hook mints it).
//                        Rules (verified against 0.40.2 by tools/pb-local.mjs + the e2e):
//                          list   @request.auth.id != ""            members see names + roles
//                          view   id = @request.auth.id || @request.auth.role = "원장"
//                          create null                              hook only
//                          update owner anything; a member only ITSELF and only password /
//                                 mustChangePin — role · name · staffId · email locked. NOTE: a
//                                 password change invalidates that user's tokens (observed), so
//                                 the app changes its own PIN through POST /api/clinic/me/pin
//                                 (password + wrapped key in one transaction) and re-authenticates.
//                          delete @request.auth.role = "원장"
//                          manage @request.auth.role = "원장"       owner may set another user's
//                                 password without the old one (the hook's reset path uses the
//                                 superuser context anyway; the rule keeps the SDK path honest)
//   staff_keys (base)  — ONE row per login, record id == user id: `wrapped` = the clinic master key
//                        wrapped under that user's PIN (AES-GCM, js/security/crypto.js wrapMaster;
//                        opaque to the server). Kept OUT of staff_users on purpose: a list rule on
//                        the auth collection would hand every member every colleague's wrapped key,
//                        and a key wrapped under a 6-digit PIN is brute-forceable offline in
//                        minutes. Rules: list null · view/update `user = @request.auth.id` (the
//                        user reads its own blob right after login; the owner cannot read others')
//                        · create/delete null (hook; cascadeDelete with the user).
//   intake_card (existing) — list/view/create/update/delete tightened to @request.auth.id != ""
//                        (members only; realtime honours the same rule per connection). `ws`
//                        (the per-device workspace hash of 004) becomes OPTIONAL and unvalidated:
//                        one clinic = one key, the client stops sending it. Existing rows keep
//                        their value; they were encrypted with a device-local key and therefore
//                        do not decrypt under the clinic key → the board counts them as foreign.
//                        Left nullable rather than dropped so the down-migration is lossless.
//   settings           — built-in rate limiter ON (auth-with-password is the brute-force surface
//                        of a 6-digit PIN), client IP taken from Caddy's X-Forwarded-For
//                        (rightmost = set by Caddy, not spoofable by the client).
//
// Down: drops the three new collections, restores 004's open intake_card rules + required `ws`,
// disables the rate limiter.
migrate((app) => {
  // ── workspace ──
  const ws = new Collection({
    type: "base",
    name: "workspace",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "slug", required: true, min: 1, max: 32, pattern: "^[a-z0-9-]+$" },
      { type: "text", name: "name", required: false, max: 80 },
      { type: "text", name: "salt", required: true, min: 20, max: 48, pattern: "^[A-Za-z0-9+/=]+$" }, // base64 of 16–32 bytes
      { type: "json", name: "directory", required: false, maxSize: 4096 },
      { type: "bool", name: "bootstrapped" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  ws.addIndex("idx_workspace_slug", true, "slug", "");
  app.save(ws);

  // ── staff_users (auth) ──
  // System fields (id · password · tokenKey · email · emailVisibility · verified) and the tokenKey/email
  // unique indexes are added by PocketBase itself for type "auth" (confirmed against 0.40.2: listing
  // them here fails with "index definition already exists").
  const users = new Collection({
    type: "auth",
    name: "staff_users",
    listRule: '@request.auth.id != ""',
    viewRule: '(id = @request.auth.id || @request.auth.role = "원장") && @request.auth.collectionName = "staff_users"',
    createRule: null,
    updateRule: '@request.auth.collectionName = "staff_users" && (@request.auth.role = "원장" || (id = @request.auth.id && @request.body.role:isset = false && @request.body.name:isset = false && @request.body.staffId:isset = false && @request.body.email:isset = false && @request.body.verified:isset = false))',
    deleteRule: '@request.auth.role = "원장" && @request.auth.collectionName = "staff_users"',
    manageRule: '@request.auth.role = "원장" && @request.auth.collectionName = "staff_users"',
    authRule: "",
    passwordAuth: { enabled: true, identityFields: ["email"] },
    oauth2: { enabled: false },
    otp: { enabled: false },
    mfa: { enabled: false },
    fields: [
      { type: "text", name: "name", required: true, min: 1, max: 20 },
      { type: "select", name: "role", required: true, maxSelect: 1, values: ["원장", "행정", "원무"] },
      { type: "text", name: "staffId", required: false, max: 64 },
      { type: "bool", name: "mustChangePin" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(users);

  // ── staff_keys (the per-user wrapped master key) ──
  const keys = new Collection({
    type: "base",
    name: "staff_keys",
    listRule: null,
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule: 'user = @request.auth.id && @request.body.user:isset = false',
    deleteRule: null,
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "json", name: "wrapped", required: true, maxSize: 2048 }, // { salt, iterations, wrapped:{v,iv,ct} }
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  keys.addIndex("idx_staff_keys_user", true, "user", "");
  app.save(keys);

  // ── intake_card: members only, ws optional ──
  const cards = app.findCollectionByNameOrId("intake_card");
  cards.listRule = '@request.auth.id != ""';
  cards.viewRule = '@request.auth.id != ""';
  cards.createRule = '@request.auth.id != ""';
  cards.updateRule = '@request.auth.id != ""';
  cards.deleteRule = '@request.auth.id != ""';
  const wsField = cards.fields.getByName("ws");
  wsField.required = false;
  wsField.min = 0;
  wsField.pattern = "";
  app.save(cards);

  // ── rate limiter + trusted proxy ──
  // Labels: "*:auth" = every auth action of every auth collection (auth-with-password, refresh …);
  // a path prefix matches every route under it. Per client IP; behind Caddy the client IP is the
  // rightmost X-Forwarded-For entry (useLeftmostIP=false). Confidence: medium on the exact
  // settings field names — verified against the local 0.40.2 binary by tools/pb-local.mjs.
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    { label: "*:auth", maxRequests: 12, duration: 10 },
    { label: "/api/clinic/", maxRequests: 30, duration: 10 },
    { label: "*:create", maxRequests: 40, duration: 5 },
    { label: "/api/", maxRequests: 300, duration: 10 },
  ];
  settings.trustedProxy.headers = ["X-Forwarded-For"];
  settings.trustedProxy.useLeftmostIP = false;
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.rateLimits.enabled = false;
  settings.rateLimits.rules = [];
  settings.trustedProxy.headers = [];
  app.save(settings);

  const cards = app.findCollectionByNameOrId("intake_card");
  cards.listRule = "";
  cards.viewRule = "";
  cards.createRule = "";
  cards.updateRule = "";
  cards.deleteRule = "";
  const wsField = cards.fields.getByName("ws");
  wsField.required = true;
  wsField.min = 64;
  wsField.pattern = "^[a-f0-9]{64}$";
  app.save(cards);

  app.delete(app.findCollectionByNameOrId("staff_keys"));
  app.delete(app.findCollectionByNameOrId("staff_users"));
  app.delete(app.findCollectionByNameOrId("workspace"));
});

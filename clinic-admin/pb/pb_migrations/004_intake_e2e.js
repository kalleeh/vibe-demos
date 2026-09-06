// clinic-admin/pb/pb_migrations/004_intake_e2e.js
//
// END-TO-END ENCRYPTED intake board. Cards are encrypted in the browser with the
// workspace master key (js/security/crypto.js, AES-GCM) BEFORE upload. The server
// stores only:
//
//   ws        text, required, max 64, ^[a-f0-9]{64}$  — sha256(workspaceId); routes rows
//                                                       to a workspace, reveals nothing
//   payload   json, maxSize 4096                      — { v:1, iv, ct } ciphertext of
//                                                       { name, summary }
//   status    text, required, 대기|진료중|완료       — plaintext column placement
//   player_id text, max 64                            — anonymous UUID (unchanged)
//
// The plaintext fields patient_name + summary are DROPPED (their data is purged with
// them). The frontend filters list + realtime by `ws`, so a browser only ever receives
// its own workspace's ciphertext.
//
// RULES stay open ("" for list/view/create/update/delete) — same rationale as 001:
// any device in the demo must be able to advance any card, and there is no login.
// A per-request filter such as `ws = @request.query.ws` is NOT usable as a list rule
// because realtime subscriptions carry no query, so the client-side filter is a
// convenience, not access control.
//
// RESIDUAL RISK (stated honestly):
//   · Anyone can READ every row — but every row is ciphertext + a hash + a status.
//   · Anyone can WRITE ciphertext garbage (or copy someone's `ws` and post junk that will
//     not decrypt → the client hides it and shows "다른 워크스페이스 카드 N"). They can also
//     DELETE or flip `status` on rows they cannot read. Availability/integrity of the
//     shared board is therefore NOT protected; confidentiality of the card body IS.
//   · `status` and creation times are visible → coarse activity metadata leaks.
//
// TIER-3 PATH (what real use would need): an auth collection (`users`), an
// `owner`/`workspace` relation, rules
//   listRule/viewRule = "workspace.members ?= @request.auth.id"
//   createRule        = "@request.auth.id != '' && workspace.members ?= @request.auth.id"
//   updateRule/deleteRule = same, plus `@request.body.payload:isset = false` on status-only
//   updates — and realtime then honours the same rules per connection. Combine with the
//   client-side encryption here for defence in depth.
//
// NOT DEPLOYED — apply with sync-backends.sh on explicit request (after 003).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("intake_card");

  collection.fields.add(new Field({
    type: "text", name: "ws", required: true, min: 64, max: 64, pattern: "^[a-f0-9]{64}$",
    system: false, hidden: false, presentable: false,
  }));
  collection.fields.add(new Field({
    type: "json", name: "payload", required: true, maxSize: 4096,
    system: false, hidden: false, presentable: false,
  }));

  // Plaintext fields go away — with their data.
  collection.fields.removeByName("patient_name");
  collection.fields.removeByName("summary");

  // Realtime + list filter by workspace hash (Collection.addIndex(name, unique, columnsExpr, whereExpr)).
  collection.addIndex("idx_intake_card_ws", false, "ws", "");

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("intake_card");

  collection.removeIndex("idx_intake_card_ws");
  collection.fields.removeByName("ws");
  collection.fields.removeByName("payload");

  // Restore 003's shape (data is not recoverable — it was ciphertext anyway).
  const FICTIONAL_NAMES = ["예시 환자", "김민서", "이준호", "박서연", "정우진", "최하은", "강도윤", "윤지아", "임시우"];
  collection.fields.add(new Field({
    type: "text", name: "patient_name", required: false, max: 20, pattern: "^(" + FICTIONAL_NAMES.join("|") + ")$",
    system: false, hidden: false, presentable: false,
  }));
  collection.fields.add(new Field({
    type: "text", name: "summary", required: false, max: 120,
    system: false, hidden: false, presentable: false,
  }));

  app.save(collection);
});

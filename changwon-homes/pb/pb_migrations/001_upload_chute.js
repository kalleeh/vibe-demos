// changwon-homes/pb/pb_migrations/001_upload_chute.js
//
// A PRIVATE, auth-gated file-drop chute. Used to get source files (e.g. MOLIT
// 실거래가 Excel/CSV) from a phone into the project without a third-party host.
//
// Two collections:
//   - uploaders (auth): a single scoped login account. NOT the superuser, so a
//     leaked uploader credential cannot touch anything else on the server.
//   - uploads (base): write-only drop box. An authenticated uploader may CREATE
//     records (file + note); nobody may list/view/update/delete via the API.
//     Files are retrieved out-of-band over SSH from the server's pb_data dir.
//
// Syntax verified against current PocketBase JSVM docs via Context7 (2026-06-08):
// `new Collection({...})`, file-field props (maxSelect/maxSize/mimeTypes), and
// auth-collection defaults. Re-check Context7 before editing — PB churns fast.

migrate((app) => {
  // --- auth collection: uploaders ---
  // newAuthCollection loads the default auth system fields (email, password,
  // tokenKey, verified, etc.) and password-auth config.
  const uploaders = new Collection({
    type: "auth",
    name: "uploaders",
    // Who may authenticate. Empty string = any record in this collection may
    // log in (we control membership by only ever creating the one account).
    authRule: "",
    // No public self-service: nobody can list/view/create/update/delete
    // uploader records through the API. The account is seeded over SSH.
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    // Allow username/email + password login (default identity fields).
    passwordAuth: {
      enabled: true,
      identityFields: ["email"],
    },
  });
  app.save(uploaders);

  // --- base collection: uploads (write-only drop box) ---
  const uploads = new Collection({
    type: "base",
    name: "uploads",
    // Only an authenticated uploader may drop a file.
    createRule: "@request.auth.id != \"\"",
    // Everything else is closed via the API — retrieval is over SSH.
    listRule: null,
    viewRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "file",
        name: "file",
        required: true,
        maxSelect: 10,                 // allow a batch (one MOLIT file per 구 × type)
        maxSize: 26214400,             // 25 MB per file — MOLIT exports are small
        mimeTypes: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
          "application/vnd.ms-excel",                                          // .xls
          "text/csv",
          "application/csv",
          "text/plain",                                                        // some .csv served as text/plain
          "application/octet-stream",                                          // iOS Safari sometimes sends this
        ],
      },
      { type: "text", name: "note", required: false, max: 200 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(uploads);
}, (app) => {
  // rollback
  const uploads = app.findCollectionByNameOrId("uploads");
  if (uploads) app.delete(uploads);
  const uploaders = app.findCollectionByNameOrId("uploaders");
  if (uploaders) app.delete(uploaders);
});

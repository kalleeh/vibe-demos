// clinic-admin/pb/pb_migrations/006_sync_blobs.js
//
// ENTITY SYNC (step B of the single-clinic instance). Step A moved users, PIN auth and the intake
// board to the server; every OTHER Store key (roster, patient register, claim batches, appeals,
// trackers, tariff, org profile, activity log, settings) still lived only on the device that typed
// it. This migration adds the two collections js/core/sync.js mirrors that data into — as
// CIPHERTEXT ONLY, sealed client-side under the clinic master key (Session.key(), identical on
// every device). The server holds key names, sizes and timestamps; never a value.
//
//   sync_blob (base) — one row per Store key (record id = sha256(key)[0..15], so every device
//                      addresses the same row without a lookup and the batch API can upsert):
//                        key       text, unique, ≤120 — the Store key ("staff.list", "claims.batch.b-…")
//                        payload   json ≤256 KB — the { v:1, iv, ct } AES-GCM envelope of the value
//                                  (plain-tier keys are encrypted for transport/at-rest too — one
//                                  envelope format for everything; only the DEVICE keeps plain keys plain)
//                        rev       number — monotonically bumped by the writer (local rev + 1)
//                        updatedBy text ≤64 — the writer's staffId (roster row id; opaque)
//                        deleted   bool — soft delete (the row stays so peers learn about the removal)
//                        created / updated autodate — `updated` (server clock) is the LWW timestamp
//                      Rules: list/view/create/update `@request.auth.id != ""` (every member),
//                      delete null (soft-delete only; 전체 파기 blanks payload + sets deleted).
//   sync_file (base) — one row per encrypted attachment (licence photo):
//                        key text unique ≤120 (the attachment id) · blob file (single, ≤5 MB — the
//                        JSON of the AES-GCM envelope over the whole attachment record, i.e. the
//                        exact ciphertext shape core/attachments.js keeps in IndexedDB) ·
//                        updatedBy · deleted · created/updated. Same rules.
//   settings         — batch API ON (the first push of an existing device is one /api/batch
//                      request of ≤50 upserts instead of 30 rate-limited creates); rate limit
//                      `/api/collections/sync_blob/` 120 / 10 s and `/api/batch` 20 / 10 s appended
//                      to the 005 rules (the `*:create` 40 / 5 s rule stays for single creates).
//
// Single clinic = single workspace: there is deliberately no `workspace` column — one instance,
// one clinic, one key (the same design as intake_card after 005).
//
// Down: drops both collections, disables the batch API, removes the two rate-limit rules.
migrate((app) => {
  const blobs = new Collection({
    type: "base",
    name: "sync_blob",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: null,
    fields: [
      { type: "text", name: "key", required: true, min: 1, max: 120, pattern: "^[A-Za-z0-9._-]+$" },
      { type: "json", name: "payload", required: false, maxSize: 262144 },
      { type: "number", name: "rev", required: false, min: 0, onlyInt: true },
      { type: "text", name: "updatedBy", required: false, max: 64 },
      { type: "bool", name: "deleted" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  blobs.addIndex("idx_sync_blob_key", true, "key", "");
  blobs.addIndex("idx_sync_blob_updated", false, "updated", "");
  app.save(blobs);

  const files = new Collection({
    type: "base",
    name: "sync_file",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: null,
    fields: [
      { type: "text", name: "key", required: true, min: 1, max: 120, pattern: "^[A-Za-z0-9._-]+$" },
      { type: "file", name: "blob", required: false, maxSelect: 1, maxSize: 5242880, mimeTypes: [], protected: false },
      { type: "text", name: "updatedBy", required: false, max: 64 },
      { type: "bool", name: "deleted" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  files.addIndex("idx_sync_file_key", true, "key", "");
  app.save(files);

  const settings = app.settings();
  settings.batch.enabled = true;
  settings.batch.maxRequests = 100;
  settings.batch.timeout = 15;
  settings.batch.maxBodySize = 33554432; // 32 MB — a batch of ≤50 envelopes of ≤256 KB
  const rules = (settings.rateLimits.rules || []).filter((r) => r.label !== "/api/collections/sync_blob/" && r.label !== "/api/batch");
  rules.push({ label: "/api/collections/sync_blob/", maxRequests: 120, duration: 10 });
  rules.push({ label: "/api/batch", maxRequests: 20, duration: 10 });
  settings.rateLimits.rules = rules;
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.batch.enabled = false;
  settings.rateLimits.rules = (settings.rateLimits.rules || []).filter((r) => r.label !== "/api/collections/sync_blob/" && r.label !== "/api/batch");
  app.save(settings);
  app.delete(app.findCollectionByNameOrId("sync_file"));
  app.delete(app.findCollectionByNameOrId("sync_blob"));
});

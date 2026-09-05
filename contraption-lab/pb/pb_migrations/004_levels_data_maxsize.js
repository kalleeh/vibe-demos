// contraption-lab/pb/pb_migrations/004_levels_data_maxsize.js
// Cap the size of a community level's `data` JSON blob. Without maxSize PocketBase
// applies its 1 MB default, so an authenticated user could publish megabytes of
// parts that every Browse visitor then downloads and simulates. 64 KB matches the
// client-side cap in js/level.js (LEVEL_LIMITS.jsonBytes) — the client rejects
// oversize levels before upload; this makes the server enforce the same limit.
// Verified against the PocketBase JSVM docs via Context7 (2026-09-05):
// JSONField.maxSize is in bytes, 0 = default 1 MB; FieldsList.getByName(name).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("level");
  const data = collection.fields.getByName("data");
  data.maxSize = 65536;
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("level");
  const data = collection.fields.getByName("data");
  data.maxSize = 0; // back to PocketBase's default
  app.save(collection);
});

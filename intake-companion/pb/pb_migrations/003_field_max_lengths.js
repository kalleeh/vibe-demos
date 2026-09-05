// intake-companion/pb/pb_migrations/003_field_max_lengths.js
//
// Abuse guard for the Tier 1 public case_brief collection (anyone can create).
// The frontend already truncates client-side, but the collection must enforce
// the same caps server-side: player_id had NO max (PocketBase's implicit
// default is 5000 chars) and the others are re-asserted here so a future edit
// of 001 cannot silently loosen them. Field API: FieldsList.getByName() +
// TextField.max (verified against the PocketBase JSVM docs).
//
// NOT DEPLOYED YET — run ./sync-backends.sh from the repo root when ready.
const MAX = {
  pattern:         120,
  prescription:    120,
  points:          200,
  chief_complaint: 80,
  player_id:       64,   // UUID v4 is 36 chars
};

migrate((app) => {
  const collection = app.findCollectionByNameOrId("case_brief");
  for (const [name, max] of Object.entries(MAX)) {
    const f = collection.fields.getByName(name);
    if (f) f.max = max;
  }
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("case_brief");
  // Revert to the 001 state: player_id unbounded, others unchanged.
  const f = collection.fields.getByName("player_id");
  if (f) f.max = 0;
  app.save(collection);
});

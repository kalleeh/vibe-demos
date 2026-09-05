// sweden-food-guide/pb/pb_migrations/003_text_length_limits.js
//
// Both collections are create-only with a public createRule (""), so field
// `max` is the ONLY server-side guard against oversized payloads. 001 set
// max on name/city/note but left player_id (both collections) and spot_vote.spot
// unbounded. This migration (re)asserts every text field's max so the limits
// hold regardless of what the live instance drifted to.
//
//   community_spot: name 60 · city 20 · note 120 · player_id 64
//   spot_vote:      spot 32 · player_id 64
//
// The frontend already clips to the same numbers (NAME_MAX / CITY_MAX / NOTE_MAX
// in index.html; player_id is a 36-char UUID).
const LIMITS = {
  community_spot: { name: 60, city: 20, note: 120, player_id: 64 },
  spot_vote: { spot: 32, player_id: 64 },
};

migrate((app) => {
  for (const [collName, fields] of Object.entries(LIMITS)) {
    const collection = app.findCollectionByNameOrId(collName);
    for (const [fieldName, max] of Object.entries(fields)) {
      const f = collection.fields.getByName(fieldName);
      if (f) f.max = max;
    }
    app.save(collection);
  }
}, (app) => {
  // Revert the fields 001 left unbounded; keep 001's own limits on name/city/note.
  const revert = { community_spot: ["player_id"], spot_vote: ["spot", "player_id"] };
  for (const [collName, names] of Object.entries(revert)) {
    const collection = app.findCollectionByNameOrId(collName);
    for (const fieldName of names) {
      const f = collection.fields.getByName(fieldName);
      if (f) f.max = 0;
    }
    app.save(collection);
  }
});

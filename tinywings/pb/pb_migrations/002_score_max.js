// tinywings/pb/pb_migrations/002_score_max.js
// `score` had `min: 0` but no ceiling, so `curl -d '{"score":999999999}'`
// against the public createRule pinned a fake row to the top of the board
// forever. Cap it at a value no honest run can reach.
//
// Ceiling maths: distance m = (bx - 200) / 14. Horizontal speed is hard-
// clamped to VMAX = 1100 px/s (~78 m/s) and cannot be sustained (air drag,
// lift fade, the chasing night). A very strong 4–5 minute run at a realistic
// ~500–600 px/s average lands around 8–10 km. 20 000 m is roughly 2× that and
// would require ~4 min pinned at the physics clamp — implausible in play.
//
// Residual limitation: the score is still CLIENT-TRUSTED. This only bounds the
// damage (no absurd values); a determined caller can still post any value
// ≤ 20000 with a public createRule. Server-side replay/attestation is out of
// scope for a Tier 1 demo board.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("leaderboard");
  const f = collection.fields.getByName("score");
  f.max = 20000;
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("leaderboard");
  const f = collection.fields.getByName("score");
  f.max = null;
  app.save(collection);
});

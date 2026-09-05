// tinywings/pb/pb_migrations/003_player_upsert.js
//
// One row per player (Tier 2 anonymous identity). Until now the collection
// held one row per RUN, so a regular could fill the top 25 alone and the client
// had to dedupe by player_id after fetching a deep page. This migration turns
// `player_id` into a real identity key:
//
//   1. Adds `created` / `updated` autodate fields (PB 0.25 base collections do
//      not auto-create them). `updated` drives the "This week" tab, and only
//      moves when a player beats their own best (the client never PATCHes
//      otherwise).
//   2. DEDUPES EXISTING ROWS — this DELETES records. For every player_id with
//      more than one row it keeps the single highest-scoring row (ties: oldest
//      id wins by stable sort) and deletes the rest. Rows with an empty
//      player_id (pre-identity legacy / hand-posted) are left untouched.
//   3. Adds a PARTIAL unique index on player_id (`WHERE player_id != ''`).
//      PocketBase stores empty text as '' not NULL, so a plain unique index
//      would collide on the second legacy row; the partial index leaves those
//      alone while guaranteeing at most one row per real player.
//   4. Sets updateRule so a client may only PATCH the row whose player_id it
//      presents. createRule stays public (""), deleteRule stays closed (null).
//
// Residual limitation (unchanged from 002): player_id is a client-held UUID,
// so this is identity, not authentication. Anyone who knows an id can update
// that row. Fine for a demo board.
//
// Syntax verified via Context7 (PocketBase JSVM, 2026-09-05):
//   app.findRecordsByFilter(coll, filter, sort, limit, offset)
//   app.delete(record) · collection.fields.add(new Field({...}))
//   collection.addIndex(name, unique, columnsExpr, optWhereExpr)
//   collection.removeIndex(name)
migrate((app) => {
  const collection = app.findCollectionByNameOrId("leaderboard");

  // 1. autodates ----------------------------------------------------------
  collection.fields.add(new Field({
    type: "autodate", name: "created", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false,
  }));
  collection.fields.add(new Field({
    type: "autodate", name: "updated", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false,
  }));
  app.save(collection);

  // 2. dedupe -------------------------------------------------------------
  // Sorted -score then id, so the first row seen for a player is the one to
  // keep. limit 0 = no limit.
  const rows = app.findRecordsByFilter("leaderboard", "player_id != ''", "-score,id", 0, 0);
  const seen = {};
  let deleted = 0;
  for (const r of rows) {
    const pid = r.getString("player_id");
    if (seen[pid]) { app.delete(r); deleted++; continue; }
    seen[pid] = true;
  }
  console.log("[003_player_upsert] leaderboard rows deduped, deleted " + deleted + " duplicate row(s)");

  // 3. partial unique index + 4. update rule ------------------------------
  const fresh = app.findCollectionByNameOrId("leaderboard");
  fresh.addIndex("idx_leaderboard_player_id", true, "player_id", "player_id != ''");
  fresh.updateRule = "player_id = @request.body.player_id";
  app.save(fresh);
}, (app) => {
  // Rollback: drop the index, close updates, remove the autodates. Deleted
  // duplicate rows are NOT restored — the data loss is one-way by design.
  const collection = app.findCollectionByNameOrId("leaderboard");
  collection.removeIndex("idx_leaderboard_player_id");
  collection.updateRule = null;
  collection.fields.removeByName("created");
  collection.fields.removeByName("updated");
  app.save(collection);
});

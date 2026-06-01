// tinywings/pb/pb_migrations/001_init_leaderboard.js
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "leaderboard",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 20 },
      { type: "number", name: "score", required: true, min: 0 },
      { type: "text", name: "player_id" },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("leaderboard");
  app.delete(collection);
});

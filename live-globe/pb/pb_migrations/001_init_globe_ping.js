// live-globe/pb/pb_migrations/001_init_globe_ping.js
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "globe_ping",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "city", required: true, max: 40 },
      { type: "text", name: "note", max: 80 },
      { type: "number", name: "lat", required: true },
      { type: "number", name: "lon", required: true },
      { type: "text", name: "player_id" },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("globe_ping");
  app.delete(collection);
});

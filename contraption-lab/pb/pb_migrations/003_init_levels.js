// contraption-lab/pb/pb_migrations/003_init_levels.js
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const level = new Collection({
    type: "base", name: "level",
    listRule: "published = true", viewRule: "published = true",
    createRule: "@request.auth.id != \"\" && author = @request.auth.id",
    updateRule: "author = @request.auth.id",
    deleteRule: "author = @request.auth.id",
    fields: [
      { type: "relation", name: "author", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "author_name", max: 40 },
      { type: "text", name: "title", required: true, max: 60 },
      { type: "json", name: "data", required: true },
      { type: "bool", name: "published" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(level);

  const rating = new Collection({
    type: "base", name: "rating",
    listRule: "", viewRule: "",
    createRule: "@request.auth.id != \"\" && user = @request.auth.id",
    updateRule: "user = @request.auth.id", deleteRule: "user = @request.auth.id",
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "level", required: true, collectionId: level.id, maxSelect: 1, cascadeDelete: true },
      { type: "number", name: "value", min: 0 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  });
  app.save(rating);
  rating.addIndex("idx_rating_user_level", true, "user, level", "");
  app.save(rating);

  const play = new Collection({
    type: "base", name: "play",
    listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "level", required: true, collectionId: level.id, maxSelect: 1, cascadeDelete: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  });
  app.save(play);
}, (app) => {
  for (const n of ["play", "rating", "level"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_e) {}
  }
});

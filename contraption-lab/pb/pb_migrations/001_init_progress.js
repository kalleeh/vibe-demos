// contraption-lab/pb/pb_migrations/001_init_progress.js
// Verified against PocketBase 0.25.8 + Context7 (2026-06-20).
// The default `users` auth collection already exists — we reference it, never create it.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    type: "base",
    name: "progress",
    // Public read so leaderboards are visible to everyone (signed in or not).
    listRule: "",
    viewRule: "",
    // Only a signed-in user may create their own row, and only update their own.
    createRule: "@request.auth.id != \"\" && user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: null,
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text",   name: "level_id",   required: true, max: 40 },
      { type: "bool",   name: "solved" },
      { type: "number", name: "best_parts", min: 0 },
      { type: "number", name: "best_ms",    min: 0 },
      // PB 0.25 base collections do NOT auto-create created/updated — declare them.
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });

  app.save(collection);

  // One row per (user, level) — enforced at the DB so best-of upserts can't duplicate.
  collection.addIndex("idx_progress_user_level", true, "user, level_id", "");
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("progress");
  app.delete(collection);
});

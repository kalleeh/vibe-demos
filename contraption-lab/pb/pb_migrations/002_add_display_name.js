// contraption-lab/pb/pb_migrations/002_add_display_name.js
// Denormalize the player's display name onto each progress row so the public
// leaderboard can show it WITHOUT expanding the shared `users` relation —
// the default `users` collection has viewRule "id = @request.auth.id", so an
// `expand: "user"` only resolves the viewer's own row and everyone else would
// render as "Anonymous". Writing the name onto the row (it's public-read)
// fixes the leaderboard for all players without weakening `users`' rules.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("progress");
  collection.fields.add(new TextField({ name: "display_name", max: 40 }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("progress");
  const f = collection.fields.getByName("display_name");
  if (f) collection.fields.removeById(f.id);
  app.save(collection);
});

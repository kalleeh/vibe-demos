// clinic-admin/pb/pb_hooks/identity.pb.js
// Shared identity for the single-clinic instance (step A) — the writes that the collection rules of
// 005_cloud_identity.js deliberately do NOT allow through the record API:
//
//   POST   /api/clinic/bootstrap        first run only (workspace.bootstrapped == false):
//                                        creates the workspace row + the first 원장 (+ its key row)
//   POST   /api/clinic/users            원장: creates a login with a TEMP PIN (mustChangePin)
//   POST   /api/clinic/users/{id}/reset 원장: new temp password + wrapped key, mustChangePin,
//                                        tokens of that user invalidated
//   DELETE /api/clinic/users/{id}       원장: removes the login (not itself); key row cascades
//   POST   /api/clinic/me/pin           any member: own PIN change — verifies the old password,
//                                        writes the new password + the re-wrapped key in ONE
//                                        transaction (a two-step SDK update could leave the
//                                        password and the wrapped key under different PINs)
//
// Every handler rebuilds `workspace.directory` from the staff_users table (source of truth), so
// the public dropdown never drifts. Bodies are validated for SHAPE + SIZE only; nothing about a
// body is ever logged. The password the client sends is base64(PBKDF2-SHA256(PIN, workspace.salt,
// 310k)) — 44 chars — never the PIN; `wrapped` is the clinic master key wrapped under that PIN
// (opaque ciphertext to the server, stored in staff_keys with id == user id).
//
// PB JSVM constraints (same as ai/pb/pb_hooks/proxy.pb.js): a routerAdd handler runs in an
// ISOLATED scope — it cannot see file-scope declarations — so every helper is repeated inside
// each handler. Verified against the 0.40.2 binary by clinic-admin/tools/pb-local.mjs:
//   e.auth (Record|null) · e.request.pathValue("id") · e.requestInfo().body · new Record(col) ·
//   record.setPassword / validatePassword / refreshTokenKey · $app.save / $app.delete ·
//   $app.findRecordsByFilter · $app.runInTransaction · $security.randomStringWithAlphabet.

routerAdd("POST", "/api/clinic/bootstrap", (e) => {
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  const originAllowed = (o) => {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(String(o || ""));
    if (!m) return false;
    const scheme = m[1].toLowerCase(), host = m[2].toLowerCase();
    if (ALLOWED_ORIGINS.indexOf(scheme + "://" + host) !== -1) return true;
    const hostname = host.replace(/:\d+$/, "");
    return scheme === "http" && (hostname === "localhost" || hostname === "127.0.0.1");
  };
  const isStr = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
  const isB64 = (v, min, max) => isStr(v, min, max) && B64.test(v);
  const validWrapped = (w) => !!w && typeof w === "object" && isB64(w.salt, 16, 64) && Number.isInteger(w.iterations) && w.iterations >= 100000 && w.iterations <= 2000000
    && !!w.wrapped && typeof w.wrapped === "object" && w.wrapped.v === 1 && isB64(w.wrapped.iv, 16, 16) && isB64(w.wrapped.ct, 44, 128);
  const validPassword = (p) => isB64(p, 40, 64);
  const publicEntry = (r) => ({ id: r.id, staffId: r.getString("staffId") || null, name: r.getString("name"), role: r.getString("role") });

  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });

  let body;
  try { body = e.requestInfo().body || {}; } catch (_) { return e.json(400, { error: "bad body" }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const workspaceName = typeof body.workspaceName === "string" ? body.workspaceName.trim() : "";
  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  if (!isStr(name, 1, 20) || !isStr(workspaceName, 0, 80) || !isStr(staffId, 0, 64)) return e.json(400, { error: "bad name" });
  if (body.role !== "원장") return e.json(400, { error: "first user must be 원장" });
  if (!validPassword(body.password)) return e.json(400, { error: "bad password shape" });
  if (!isB64(body.salt, 20, 48)) return e.json(400, { error: "bad salt" });
  if (!validWrapped(body.wrapped)) return e.json(400, { error: "bad wrapped key" });

  let out = null;
  try {
    $app.runInTransaction((tx) => {
      let ws = null;
      try { ws = tx.findFirstRecordByFilter("workspace", "slug = 'default'"); } catch (_) { ws = null; }
      if (ws && ws.getBool("bootstrapped")) { out = { status: 409, body: { error: "already bootstrapped" } }; return; }
      const id = $security.randomStringWithAlphabet(15, "abcdefghijklmnopqrstuvwxyz0123456789");
      const u = new Record(tx.findCollectionByNameOrId("staff_users"));
      u.set("id", id);
      u.set("email", id + "@clinic.local");
      u.set("emailVisibility", false);
      u.set("verified", true);
      u.setPassword(body.password);
      u.set("name", name);
      u.set("role", "원장");
      u.set("staffId", staffId);
      u.set("mustChangePin", false);
      tx.save(u);
      const k = new Record(tx.findCollectionByNameOrId("staff_keys"));
      k.set("id", id);
      k.set("user", id);
      k.set("wrapped", body.wrapped);
      tx.save(k);
      if (!ws) { ws = new Record(tx.findCollectionByNameOrId("workspace")); ws.set("slug", "default"); }
      ws.set("name", workspaceName);
      ws.set("salt", body.salt);
      ws.set("directory", [publicEntry(u)]);
      ws.set("bootstrapped", true);
      tx.save(ws);
      out = { status: 200, body: { id: id, email: id + "@clinic.local", workspace: { slug: "default", name: workspaceName, salt: body.salt, directory: [publicEntry(u)], bootstrapped: true } } };
    });
  } catch (err) {
    return e.json(500, { error: "bootstrap failed" });
  }
  return e.json(out.status, out.body);
});

routerAdd("POST", "/api/clinic/users", (e) => {
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const ROLES = ["원장", "행정", "원무"];
  const MAX_USERS = 12;
  const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  const originAllowed = (o) => {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(String(o || ""));
    if (!m) return false;
    const scheme = m[1].toLowerCase(), host = m[2].toLowerCase();
    if (ALLOWED_ORIGINS.indexOf(scheme + "://" + host) !== -1) return true;
    const hostname = host.replace(/:\d+$/, "");
    return scheme === "http" && (hostname === "localhost" || hostname === "127.0.0.1");
  };
  const isStr = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
  const isB64 = (v, min, max) => isStr(v, min, max) && B64.test(v);
  const validWrapped = (w) => !!w && typeof w === "object" && isB64(w.salt, 16, 64) && Number.isInteger(w.iterations) && w.iterations >= 100000 && w.iterations <= 2000000
    && !!w.wrapped && typeof w.wrapped === "object" && w.wrapped.v === 1 && isB64(w.wrapped.iv, 16, 16) && isB64(w.wrapped.ct, 44, 128);
  const validPassword = (p) => isB64(p, 40, 64);
  const publicEntry = (r) => ({ id: r.id, staffId: r.getString("staffId") || null, name: r.getString("name"), role: r.getString("role") });
  const directoryOf = (tx) => tx.findRecordsByFilter("staff_users", "id != ''", "created", 200, 0).map(publicEntry);

  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const auth = e.auth;
  if (!auth || auth.collection().name !== "staff_users") return e.json(401, { error: "login required" });
  if (auth.getString("role") !== "원장") return e.json(403, { error: "owner required" });

  let body;
  try { body = e.requestInfo().body || {}; } catch (_) { return e.json(400, { error: "bad body" }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  if (!isStr(name, 1, 20) || !isStr(staffId, 0, 64)) return e.json(400, { error: "bad name" });
  if (ROLES.indexOf(body.role) === -1) return e.json(400, { error: "bad role" });
  if (!validPassword(body.password)) return e.json(400, { error: "bad password shape" });
  if (!validWrapped(body.wrapped)) return e.json(400, { error: "bad wrapped key" });
  // Demo seed only: the shared sample logins keep their documented PIN. Anything else → temp PIN.
  const mustChange = body.mustChangePin === false ? false : true;

  let out = null;
  try {
    $app.runInTransaction((tx) => {
      let ws;
      try { ws = tx.findFirstRecordByFilter("workspace", "slug = 'default'"); } catch (_) { ws = null; }
      if (!ws || !ws.getBool("bootstrapped")) { out = { status: 409, body: { error: "not bootstrapped" } }; return; }
      const existing = directoryOf(tx);
      if (existing.length >= MAX_USERS) { out = { status: 409, body: { error: "max users" } }; return; }
      const id = $security.randomStringWithAlphabet(15, "abcdefghijklmnopqrstuvwxyz0123456789");
      const u = new Record(tx.findCollectionByNameOrId("staff_users"));
      u.set("id", id);
      u.set("email", id + "@clinic.local");
      u.set("emailVisibility", false);
      u.set("verified", true);
      u.setPassword(body.password);
      u.set("name", name);
      u.set("role", body.role);
      u.set("staffId", staffId);
      u.set("mustChangePin", mustChange);
      tx.save(u);
      const k = new Record(tx.findCollectionByNameOrId("staff_keys"));
      k.set("id", id);
      k.set("user", id);
      k.set("wrapped", body.wrapped);
      tx.save(k);
      const dir = directoryOf(tx);
      ws.set("directory", dir);
      tx.save(ws);
      out = { status: 200, body: { id: id, email: id + "@clinic.local", mustChangePin: mustChange, directory: dir } };
    });
  } catch (err) {
    return e.json(500, { error: "create failed" });
  }
  return e.json(out.status, out.body);
});

routerAdd("POST", "/api/clinic/users/{id}/reset", (e) => {
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  const originAllowed = (o) => {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(String(o || ""));
    if (!m) return false;
    const scheme = m[1].toLowerCase(), host = m[2].toLowerCase();
    if (ALLOWED_ORIGINS.indexOf(scheme + "://" + host) !== -1) return true;
    const hostname = host.replace(/:\d+$/, "");
    return scheme === "http" && (hostname === "localhost" || hostname === "127.0.0.1");
  };
  const isStr = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
  const isB64 = (v, min, max) => isStr(v, min, max) && B64.test(v);
  const validWrapped = (w) => !!w && typeof w === "object" && isB64(w.salt, 16, 64) && Number.isInteger(w.iterations) && w.iterations >= 100000 && w.iterations <= 2000000
    && !!w.wrapped && typeof w.wrapped === "object" && w.wrapped.v === 1 && isB64(w.wrapped.iv, 16, 16) && isB64(w.wrapped.ct, 44, 128);
  const validPassword = (p) => isB64(p, 40, 64);

  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const auth = e.auth;
  if (!auth || auth.collection().name !== "staff_users") return e.json(401, { error: "login required" });
  if (auth.getString("role") !== "원장") return e.json(403, { error: "owner required" });
  const id = e.request.pathValue("id") || "";
  if (!/^[a-z0-9]{15}$/.test(id)) return e.json(400, { error: "bad id" });

  let body;
  try { body = e.requestInfo().body || {}; } catch (_) { return e.json(400, { error: "bad body" }); }
  if (!validPassword(body.password)) return e.json(400, { error: "bad password shape" });
  if (!validWrapped(body.wrapped)) return e.json(400, { error: "bad wrapped key" });

  let out = null;
  try {
    $app.runInTransaction((tx) => {
      let target, key;
      try { target = tx.findRecordById("staff_users", id); key = tx.findRecordById("staff_keys", id); } catch (_) { out = { status: 404, body: { error: "no such user" } }; return; }
      target.setPassword(body.password);
      target.refreshTokenKey(); // every session of that user is invalidated — their devices must log in with the temp PIN
      target.set("mustChangePin", true);
      tx.save(target);
      key.set("wrapped", body.wrapped);
      tx.save(key);
      out = { status: 200, body: { id: id, mustChangePin: true } };
    });
  } catch (err) {
    return e.json(500, { error: "reset failed" });
  }
  return e.json(out.status, out.body);
});

routerAdd("DELETE", "/api/clinic/users/{id}", (e) => {
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const originAllowed = (o) => {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(String(o || ""));
    if (!m) return false;
    const scheme = m[1].toLowerCase(), host = m[2].toLowerCase();
    if (ALLOWED_ORIGINS.indexOf(scheme + "://" + host) !== -1) return true;
    const hostname = host.replace(/:\d+$/, "");
    return scheme === "http" && (hostname === "localhost" || hostname === "127.0.0.1");
  };
  const publicEntry = (r) => ({ id: r.id, staffId: r.getString("staffId") || null, name: r.getString("name"), role: r.getString("role") });
  const directoryOf = (tx) => tx.findRecordsByFilter("staff_users", "id != ''", "created", 200, 0).map(publicEntry);

  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const auth = e.auth;
  if (!auth || auth.collection().name !== "staff_users") return e.json(401, { error: "login required" });
  if (auth.getString("role") !== "원장") return e.json(403, { error: "owner required" });
  const id = e.request.pathValue("id") || "";
  if (!/^[a-z0-9]{15}$/.test(id)) return e.json(400, { error: "bad id" });
  if (id === auth.id) return e.json(400, { error: "cannot delete yourself" });

  let out = null;
  try {
    $app.runInTransaction((tx) => {
      let target;
      try { target = tx.findRecordById("staff_users", id); } catch (_) { out = { status: 404, body: { error: "no such user" } }; return; }
      tx.delete(target); // staff_keys row cascades (relation cascadeDelete)
      const ws = tx.findFirstRecordByFilter("workspace", "slug = 'default'");
      const dir = directoryOf(tx);
      ws.set("directory", dir);
      tx.save(ws);
      out = { status: 200, body: { id: id, directory: dir } };
    });
  } catch (err) {
    return e.json(500, { error: "delete failed" });
  }
  return e.json(out.status, out.body);
});

routerAdd("POST", "/api/clinic/me/pin", (e) => {
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  const originAllowed = (o) => {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(String(o || ""));
    if (!m) return false;
    const scheme = m[1].toLowerCase(), host = m[2].toLowerCase();
    if (ALLOWED_ORIGINS.indexOf(scheme + "://" + host) !== -1) return true;
    const hostname = host.replace(/:\d+$/, "");
    return scheme === "http" && (hostname === "localhost" || hostname === "127.0.0.1");
  };
  const isStr = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
  const isB64 = (v, min, max) => isStr(v, min, max) && B64.test(v);
  const validWrapped = (w) => !!w && typeof w === "object" && isB64(w.salt, 16, 64) && Number.isInteger(w.iterations) && w.iterations >= 100000 && w.iterations <= 2000000
    && !!w.wrapped && typeof w.wrapped === "object" && w.wrapped.v === 1 && isB64(w.wrapped.iv, 16, 16) && isB64(w.wrapped.ct, 44, 128);
  const validPassword = (p) => isB64(p, 40, 64);

  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const auth = e.auth;
  if (!auth || auth.collection().name !== "staff_users") return e.json(401, { error: "login required" });

  let body;
  try { body = e.requestInfo().body || {}; } catch (_) { return e.json(400, { error: "bad body" }); }
  if (!validPassword(body.oldPassword) || !validPassword(body.password)) return e.json(400, { error: "bad password shape" });
  if (!validWrapped(body.wrapped)) return e.json(400, { error: "bad wrapped key" });

  let out = null;
  try {
    $app.runInTransaction((tx) => {
      const me = tx.findRecordById("staff_users", auth.id);
      if (!me.validatePassword(body.oldPassword)) { out = { status: 400, body: { error: "wrong old password" } }; return; }
      const key = tx.findRecordById("staff_keys", auth.id);
      me.setPassword(body.password); // refreshes the token key → the caller re-authenticates with the new password
      me.set("mustChangePin", false);
      tx.save(me);
      key.set("wrapped", body.wrapped);
      tx.save(key);
      out = { status: 200, body: { id: auth.id, mustChangePin: false } };
    });
  } catch (err) {
    return e.json(500, { error: "pin change failed" });
  }
  return e.json(out.status, out.body);
});

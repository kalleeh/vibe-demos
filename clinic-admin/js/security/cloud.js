/* clinic-admin — Cloud: the ONE PocketBase client of the app (shared single-clinic instance, step A).
   Leaf-ish module: imports only ./crypto.js. session.js sits on top of it (login / bootstrap / key management),
   board.js uses the same authenticated client for the intake cards; step B (entity sync) plugs in here too.

   Server (pb/pb_migrations/005_cloud_identity.js + pb/pb_hooks/identity.pb.js):
     workspace   slug "default" · name · salt (shared PBKDF2 salt) · directory [{id, staffId, name, role}] · bootstrapped
                 — PUBLIC read (the lock-screen dropdown works before login)
     staff_users auth · name · role (원장|행정|원무) · staffId · mustChangePin — identity "<id>@clinic.local",
                 password = base64(PBKDF2-SHA256(PIN, workspace.salt, 310k)) → bcrypt on the server. The PIN never leaves
                 the browser; the server only ever sees a 44-char derived password.
     staff_keys  id == user id · wrapped = the clinic master key wrapped under that user's PIN (opaque to the server;
                 readable only by that user)
     intake_card members only (@request.auth.id != "")
     hooks       POST /api/clinic/bootstrap · POST /api/clinic/users · POST /api/clinic/users/{id}/reset ·
                 DELETE /api/clinic/users/{id} · POST /api/clinic/me/pin

   URL: https://clinic-admin.pb.gurum.se — dev override localStorage["vibe.clinic-admin.pbUrl"] or ?pb=… (persisted).
   SDK: pocketbase@0.28.1, VENDORED at ../vendor/pocketbase.es.mjs (same-origin → precached by the SW, no CDN in the
   login path) and still verified against the pinned sha384 before it is imported from a blob URL.
   Auth store: a custom AsyncAuthStore that keeps the serialized token IN MEMORY and reports every change through
   onAuthChange — session.js seals it into the IndexedDB session record (never localStorage). */
import { b64, unb64, sha384b64, PBKDF2_ITERATIONS } from "./crypto.js";

const DEFAULT_URL = "https://clinic-admin.pb.gurum.se";
const URL_KEY = "vibe.clinic-admin.pbUrl";
const PB_ESM = new URL("../../vendor/pocketbase.es.mjs", import.meta.url).href;
// sha384 of the vendored file == the jsdelivr pocketbase@0.28.1/dist/pocketbase.es.mjs (openssl dgst -sha384 -binary | base64, 2026-09-06)
const PB_ESM_SRI = "sha384-+CEHLdvG3y8opDX+t0ebtelkKG4Gbt730x7qJtt7zgO5jC8MXhUwgSoR9cPhFFJc";
const WS_SLUG = "default";
const EMAIL_DOMAIN = "@clinic.local";
const HEALTH_TIMEOUT_MS = 5000;
const enc = new TextEncoder();

let pb = null, _pbPromise = null;
let serialized = null; // JSON string { token, record } — the auth store's persisted form, memory only
const authListeners = [];
const fireAuth = () => { for (const fn of authListeners) { try { fn(serialized); } catch (e) { console.error(e); } } };

function url() {
  try {
    const q = new URLSearchParams(location.search).get("pb");
    if (q && /^https?:\/\/[^\s/]+/.test(q)) { localStorage.setItem(URL_KEY, q.replace(/\/+$/, "")); }
    const v = localStorage.getItem(URL_KEY);
    if (v && /^https?:\/\/[^\s/]+/.test(v)) return v.replace(/\/+$/, "");
  } catch {}
  return DEFAULT_URL;
}

async function loadPBModule() {
  const r = await fetch(PB_ESM, { cache: "force-cache" });
  if (!r.ok) throw new Error("sdk " + r.status);
  const buf = await r.arrayBuffer();
  const got = "sha384-" + await sha384b64(buf);
  if (got !== PB_ESM_SRI) { console.warn("PocketBase SDK integrity mismatch", got); throw new Error("sri"); }
  const blob = URL.createObjectURL(new Blob([buf], { type: "text/javascript" }));
  try { return await import(blob); } finally { URL.revokeObjectURL(blob); }
}
function getPB() {
  if (pb) return Promise.resolve(pb);
  if (!_pbPromise) {
    _pbPromise = loadPBModule().then((m) => {
      const store = new m.AsyncAuthStore({
        save: async (s) => { serialized = s || null; fireAuth(); },
        clear: async () => { serialized = null; fireAuth(); },
        initial: serialized || undefined
      });
      pb = new m.default(url(), store);
      pb.autoCancellation(false); // parallel calls (board + directory refresh) must not cancel each other
      return pb;
    }).catch((e) => { _pbPromise = null; throw e; });
  }
  return _pbPromise;
}

/* ── error normalisation: ClientResponseError → { code, status, message } ── */
function classify(e) {
  const status = Number(e?.status || 0);
  const serverMsg = e?.response?.error || e?.response?.message || "";
  let code = "server";
  if (e?.code) code = e.code;
  else if (status === 0 || e?.isAbort) code = "offline";
  else if (status === 400 && /authenticate|wrong old password/i.test(serverMsg)) code = "wrong-pin";
  else if (status === 401 || status === 403) code = "forbidden";
  else if (status === 404) code = "not-found";
  else if (status === 409) code = "conflict";
  else if (status === 429) code = "rate";
  else if (status >= 400 && status < 500) code = "bad-request";
  return Object.assign(new Error(serverMsg || e?.message || code), { code, status, cause: e });
}
const wrap = (p) => p.catch((e) => { throw classify(e); });

/* PIN → server password. Shared workspace salt (the PIN itself never leaves the browser). */
async function derivePassword(pin, saltB64) {
  const base = await crypto.subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: PBKDF2_ITERATIONS }, base, 256);
  return b64(bits);
}
const emailOf = (userId) => userId + EMAIL_DOMAIN;
const publicWorkspace = (r) => r ? { slug: r.slug, name: r.name || "", salt: r.salt, directory: Array.isArray(r.directory) ? r.directory : [], bootstrapped: !!r.bootstrapped } : null;
const publicUser = (r) => r ? { id: r.id, name: r.name, role: r.role, staffId: r.staffId || null, mustChangePin: !!r.mustChangePin } : null;

const Cloud = {
  url, getPB, derivePassword, emailOf,
  // Reachability — plain fetch with a timeout, works before the SDK is loaded.
  async health(timeoutMs = HEALTH_TIMEOUT_MS) {
    try { const r = await fetch(url() + "/api/health", { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }); return r.ok; } catch { return false; }
  },
  // The public workspace row, or null when the instance has not been bootstrapped yet. Throws { code: "offline" } when unreachable.
  async workspace() {
    const c = await wrap(getPB());
    try { return publicWorkspace(await c.collection("workspace").getFirstListItem(c.filter("slug = {:s}", { s: WS_SLUG }))); }
    catch (e) { if (Number(e?.status) === 404) return null; throw classify(e); }
  },
  /* PIN login → { user, wrapped, workspace }. Errors: wrong-pin · rate · offline · no-workspace. */
  async login(userId, pin) {
    const ws = await this.workspace();
    if (!ws || !ws.bootstrapped) throw Object.assign(new Error("no-workspace"), { code: "no-workspace" });
    const c = await wrap(getPB());
    const password = await derivePassword(pin, ws.salt);
    const auth = await wrap(c.collection("staff_users").authWithPassword(emailOf(userId), password));
    const key = await wrap(c.collection("staff_keys").getOne(userId));
    return { user: publicUser(auth.record), wrapped: key.wrapped, workspace: ws };
  },
  /* First run: creates the workspace + the first 원장 on the server, then logs in. */
  async bootstrap({ workspaceName, name, staffId, pin, salt, wrapped }) {
    const c = await wrap(getPB());
    const password = await derivePassword(pin, salt);
    const res = await wrap(c.send("/api/clinic/bootstrap", { method: "POST", body: { name, role: "원장", staffId: staffId || "", password, wrapped, salt, workspaceName: workspaceName || "" } }));
    return this.login(res.id, pin);
  },
  /* 원장: new login with a temp PIN (the caller wrapped the master key under it). → { id, directory } */
  async createUser({ name, role, staffId, pin, wrapped, mustChangePin = true }) {
    const ws = await this.workspace();
    const c = await wrap(getPB());
    const password = await derivePassword(pin, ws.salt);
    return wrap(c.send("/api/clinic/users", { method: "POST", body: { name, role, staffId: staffId || "", password, wrapped, mustChangePin } }));
  },
  async resetPin(userId, pin, wrapped) {
    const ws = await this.workspace();
    const c = await wrap(getPB());
    const password = await derivePassword(pin, ws.salt);
    return wrap(c.send(`/api/clinic/users/${encodeURIComponent(userId)}/reset`, { method: "POST", body: { password, wrapped } }));
  },
  async deleteUser(userId) {
    const c = await wrap(getPB());
    return wrap(c.send(`/api/clinic/users/${encodeURIComponent(userId)}`, { method: "DELETE" }));
  },
  /* Own PIN: password + re-wrapped key in one server transaction, then re-authenticate (the old token dies with the
     password — observed on 0.40.2). */
  async changeOwnPin(oldPin, newPin, wrapped) {
    const ws = await this.workspace();
    const c = await wrap(getPB());
    const me = c.authStore.record;
    if (!me) throw Object.assign(new Error("not-authed"), { code: "forbidden" });
    const [oldPassword, password] = await Promise.all([derivePassword(oldPin, ws.salt), derivePassword(newPin, ws.salt)]);
    await wrap(c.send("/api/clinic/me/pin", { method: "POST", body: { oldPassword, password, wrapped } }));
    const auth = await wrap(c.collection("staff_users").authWithPassword(emailOf(me.id), password));
    return publicUser(auth.record);
  },
  /* Token check for a resumed session (also refreshes it). Throws forbidden when the login was reset/removed. */
  async verify() {
    const c = await wrap(getPB());
    if (!c.authStore.isValid) throw Object.assign(new Error("not-authed"), { code: "forbidden" });
    const auth = await wrap(c.collection("staff_users").authRefresh());
    return publicUser(auth.record);
  },
  me() {
    if (pb) return publicUser(pb.authStore.record);
    try { return serialized ? publicUser(JSON.parse(serialized).record) : null; } catch { return null; }
  },
  isAuthed() { return pb ? pb.authStore.isValid : !!serialized; },
  serialized() { return serialized; },
  // session.js hands the sealed-and-restored auth back at boot (before or after the SDK exists).
  adoptAuth(s) {
    serialized = s || null;
    if (pb) { try { const j = s ? JSON.parse(s) : null; if (j?.token) pb.authStore.save(j.token, j.record || null); else pb.authStore.clear(); } catch { pb.authStore.clear(); } }
  },
  logout() { if (pb) pb.authStore.clear(); else { serialized = null; fireAuth(); } },
  onAuthChange(fn) { authListeners.push(fn); },
  classify
};

export { Cloud, classify as classifyCloudError, PB_ESM_SRI };

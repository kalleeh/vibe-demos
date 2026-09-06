/* clinic-admin — WebCrypto primitives for the workspace key hierarchy.
   Leaf module: imports nothing.

   Hierarchy
     PIN ─PBKDF2-SHA256(≥300k, per-user salt)─▶ wrap key (AES-GCM 256)
     wrap key ─AES-GCM─▶ wrapped master key   (stored, one per user)
     master key (32 random bytes) — exists as RAW BYTES only for the moment between a PIN entry and
                 (a) importSessionKey → a NON-EXTRACTABLE AES-GCM CryptoKey (the "session key", persisted in
                     IndexedDB by session.js so a reload resumes without the PIN; it can encrypt/decrypt but
                     never be exported), and
                 (b) wrapMaster for key-management (a new user / PIN change) — needs the raw bytes again,
                     which is why those operations re-ask the PIN (session.js requireRaw).
     session key ─AES-GCM(random 96-bit IV)─▶ every sensitive Store value,
                                               every IndexedDB attachment,
                                               every 접수 보드 card payload.
   Envelope shape everywhere: { v: 1, iv: <b64>, ct: <b64> }. */

const subtle = crypto.subtle;
const PBKDF2_ITERATIONS = 310000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

function b64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function sha256hex(str) {
  const d = await subtle.digest("SHA-256", enc.encode(str));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha384b64(buf) {
  const d = await subtle.digest("SHA-384", buf);
  return b64(d);
}

const isEnvelope = (x) => !!x && typeof x === "object" && x.v === 1 && typeof x.iv === "string" && typeof x.ct === "string";

/* ── master key ── */
// 32 random bytes. Kept as bytes (not a CryptoKey) so the caller decides how long they live.
function generateMasterRaw() { return randomBytes(32); }
// The session key: NON-extractable. encrypt/decrypt only — exportKey() on it throws InvalidAccessError.
function importSessionKey(raw) {
  return subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/* ── PIN → wrap key ── */
async function deriveWrapKey(pin, saltB64, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// raw master bytes → { salt, iterations, wrapped: {v, iv, ct} }
async function wrapMaster(raw, pin) {
  if (!(raw instanceof Uint8Array) || raw.length !== 32) throw new Error("wrapMaster: raw master bytes required");
  const salt = b64(randomBytes(16));
  const iterations = PBKDF2_ITERATIONS;
  const wk = await deriveWrapKey(pin, salt, iterations);
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, wk, raw);
  return { salt, iterations, wrapped: { v: 1, iv: b64(iv), ct: b64(ct) } };
}
// → raw master bytes (Uint8Array). Throws on a wrong PIN (AES-GCM tag mismatch → OperationError).
async function unwrapMaster({ salt, iterations, wrapped }, pin) {
  const wk = await deriveWrapKey(pin, salt, iterations);
  const raw = await subtle.decrypt({ name: "AES-GCM", iv: unb64(wrapped.iv) }, wk, unb64(wrapped.ct));
  return new Uint8Array(raw);
}

/* ── payload encryption under the master key ── */
async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}
async function decryptBytes(key, env) {
  if (!isEnvelope(env)) throw new Error("not-an-envelope");
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, key, unb64(env.ct));
  return new Uint8Array(pt);
}
const encryptJSON = (key, value) => encryptBytes(key, enc.encode(JSON.stringify(value)));
const decryptJSON = async (key, env) => JSON.parse(dec.decode(await decryptBytes(key, env)));
const encryptString = (key, str) => encryptBytes(key, enc.encode(str));
const decryptString = async (key, env) => dec.decode(await decryptBytes(key, env));

export {
  PBKDF2_ITERATIONS, randomBytes, b64, unb64, sha256hex, sha384b64, isEnvelope,
  generateMasterRaw, importSessionKey, deriveWrapKey, wrapMaster, unwrapMaster,
  encryptBytes, decryptBytes, encryptJSON, decryptJSON, encryptString, decryptString
};

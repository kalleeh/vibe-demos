// contraption-lab/js/cloud.js
// Local-first cloud layer. The game works fully without any of this.
// SDK is dynamically imported inside init() so pure helpers stay Node-testable.
import { progressToRecords, recordsToProgress, applyRemote, getProgress } from "./progress.js";

const PB_URL = "https://contraption-lab.pb.gurum.se";

let pb = null;
export const cloud = { available: false };

export async function init() {
  try {
    const mod = await import("pocketbase");
    const PocketBase = mod.default;
    pb = new PocketBase(PB_URL);              // authStore auto-persists in localStorage
    await pb.health.check();
    cloud.available = true;
  } catch { cloud.available = false; }
  return cloud.available;
}

export function user() {
  if (!pb || !pb.authStore?.isValid) return null;
  const m = pb.authStore.record || pb.authStore.model; // SDK 0.26+ uses .record; .model is the 0.25 fallback
  return m ? { id: m.id, name: m.name || "", email: m.email || "" } : null;
}

export async function signup(email, password, name) {
  if (!pb) return { ok:false, error:"offline" };
  try {
    await pb.collection("users").create({ email, password, passwordConfirm: password, name: name || email.split("@")[0] });
    await pb.collection("users").authWithPassword(email, password);
    return { ok:true };
  } catch (e) { return { ok:false, error: humanError(e) }; }
}

export async function login(email, password) {
  if (!pb) return { ok:false, error:"offline" };
  try { await pb.collection("users").authWithPassword(email, password); return { ok:true }; }
  catch (e) { return { ok:false, error: humanError(e) }; }
}

export function logout() { if (pb) pb.authStore.clear(); }

// best-of of two PB-shaped progress bodies (lower parts, then lower ms wins)
export function bestOf(a, b) {
  if (!a) return b; if (!b) return a;
  const better = (b.best_parts < a.best_parts) || (b.best_parts === a.best_parts && b.best_ms < a.best_ms) ? b : a;
  return { ...better, solved: (a.solved || b.solved) };
}

// NOTE: the PB `filter` strings below interpolate only server-validated values
// (the auth user id and our own internal level ids). Never interpolate
// user-typed text (e.g. a search box) into a filter — escape via the SDK or
// reject it, or it becomes a filter-injection vector.
export async function pushProgress(map) {
  const u = user(); if (!pb || !cloud.available || !u) return;
  const rows = progressToRecords(map, u.id);
  for (const row of rows) {
    try {
      const existing = await pb.collection("progress").getFirstListItem(
        `user="${u.id}" && level_id="${row.level_id}"`).catch(() => null);
      if (existing) {
        const merged = bestOf(existing, row);
        if (merged.best_parts !== existing.best_parts || merged.best_ms !== existing.best_ms || merged.solved !== existing.solved)
          await pb.collection("progress").update(existing.id, { solved: merged.solved, best_parts: merged.best_parts, best_ms: merged.best_ms });
      } else {
        await pb.collection("progress").create(row);
      }
    } catch { /* non-blocking: a failed sync never breaks play */ }
  }
}

export async function pullProgress() {
  const u = user(); if (!pb || !cloud.available || !u) return getProgress();
  try {
    const records = await pb.collection("progress").getFullList({ filter: `user="${u.id}"` });
    return applyRemote(recordsToProgress(records));
  } catch { return getProgress(); }
}

// PB records → display rows for the leaderboard overlay
export function leaderboardRows(records = [], meId = null) {
  return records.map(r => ({
    name: (r.expand && r.expand.user && r.expand.user.name) ? r.expand.user.name : "Anonymous",
    parts: r.best_parts, ms: r.best_ms,
    isMe: !!(meId && r.expand && r.expand.user && r.expand.user.id === meId),
  }));
}

export async function leaderboard(levelId, limit = 25) {
  if (!pb || !cloud.available) return [];
  try {
    const res = await pb.collection("progress").getList(1, limit, {
      filter: `level_id="${levelId}" && solved=true`, sort: "best_parts,best_ms", expand: "user",
    });
    return leaderboardRows(res.items, user()?.id || null);
  } catch { return []; }
}

function humanError(e) {
  const m = e?.response?.message || e?.message || "something went wrong";
  return /failed to authenticate|invalid/i.test(m) ? "email or password is incorrect" : m;
}

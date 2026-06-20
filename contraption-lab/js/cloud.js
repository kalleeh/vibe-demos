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
  // Denormalize the display name onto each row so the public leaderboard can
  // render it without expanding the shared `users` relation (whose default
  // viewRule hides other users → everyone would otherwise show "Anonymous").
  const displayName = (u.name || u.email || "Anonymous").slice(0, 40);
  const rows = progressToRecords(map, u.id).map(r => ({ ...r, display_name: displayName }));
  for (const row of rows) {
    try {
      const existing = await pb.collection("progress").getFirstListItem(
        `user="${u.id}" && level_id="${row.level_id}"`).catch(() => null);
      if (existing) {
        const merged = bestOf(existing, row);
        const nameDrifted = existing.display_name !== displayName;
        if (merged.best_parts !== existing.best_parts || merged.best_ms !== existing.best_ms || merged.solved !== existing.solved || nameDrifted)
          await pb.collection("progress").update(existing.id, { solved: merged.solved, best_parts: merged.best_parts, best_ms: merged.best_ms, display_name: displayName });
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

// PB records → display rows for the leaderboard overlay.
// Reads the denormalized `display_name` (public-readable) rather than expanding
// the `user` relation, which the default users viewRule would hide for other
// players. `isMe` compares the row's `user` relation id to the viewer's id.
export function leaderboardRows(records = [], meId = null) {
  return records.map(r => ({
    name: r.display_name || "Anonymous",
    parts: r.best_parts, ms: r.best_ms,
    isMe: !!(meId && r.user === meId),
  }));
}

export async function leaderboard(levelId, limit = 25) {
  if (!pb || !cloud.available) return [];
  try {
    const res = await pb.collection("progress").getList(1, limit, {
      filter: `level_id="${levelId}" && solved=true`, sort: "best_parts,best_ms",
    });
    return leaderboardRows(res.items, user()?.id || null);
  } catch { return []; }
}

function humanError(e) {
  const m = e?.response?.message || e?.message || "something went wrong";
  return /failed to authenticate|invalid/i.test(m) ? "email or password is incorrect" : m;
}

// ─── Community Level Publishing ─────────────────────────────────────────────

export async function publishLevel({title, data}) {
  const u = user();
  if (!pb || !cloud.available) return { ok:false, error:"offline" };
  if (!u) return { ok:false, error:"sign in to publish" };

  try {
    const author_name = (u.name || u.email || "Anonymous").slice(0, 40);
    const rec = await pb.collection("level").create({
      author: u.id,
      author_name,
      title: String(title).slice(0, 60),
      data,
      published: true,
    });
    return { ok:true, id:rec.id };
  } catch (e) { return { ok:false, error:humanError(e) }; }
}

// Pure helper: PB record → display card. Testable without network.
export function levelCard(rec, plays=0, likes=0) {
  return {
    id: rec.id,
    title: rec.title || "Untitled",
    author_name: rec.author_name || "Anonymous",
    plays,
    likes,
    data: rec.data,
  };
}

export async function listLevels(tab="recent", page=1, perPage=24) {
  if (!pb || !cloud.available) return [];
  try {
    const res = await pb.collection("level").getList(page, perPage, { sort: "-created" });

    // Attach play/like counts for each level
    const cards = await Promise.all(res.items.map(async (rec) => {
      const plays = await playsCount(rec.id);
      const likes = await likesCount(rec.id);
      return levelCard(rec, plays, likes);
    }));

    // Sort by tab preference
    if (tab === "played") {
      return cards.sort((a, b) => b.plays - a.plays);
    } else if (tab === "rated") {
      return cards.sort((a, b) => b.likes - a.likes);
    }
    // "recent" stays as-is (already sorted by -created)
    return cards;
  } catch { return []; }
}

export async function getLevel(id) {
  if (!pb || !cloud.available) return null;
  try {
    return await pb.collection("level").getOne(id);
  } catch { return null; }
}

// NOTE: Filter strings below interpolate only server-validated values (level ids
// and auth user ids). User-typed search text must never be interpolated directly
// into a filter — see the NOTE in pushProgress above for the security reasoning.

// `play` is intentionally anonymous (collection createRule="", no user field): play
// counts are a coarse popularity signal, not per-user analytics. Spam is bounded by
// PocketBase's built-in rate limiting (Settings), not by app logic.
export async function recordPlay(id) {
  if (!pb || !cloud.available) return;
  try {
    await pb.collection("play").create({ level: id });
  } catch { /* best-effort: offline/errors don't block */ }
}

export async function playsCount(id) {
  if (!pb || !cloud.available) return 0;
  try {
    const res = await pb.collection("play").getList(1, 1, { filter: `level="${id}"` });
    return res.totalItems;
  } catch { return 0; }
}

// A "like" is a rating row with value>0; unliking DELETES the row (see rateLevel), so
// counting value>0 rows is the like count and stays correct if dislikes are ever added.
export async function likesCount(id) {
  if (!pb || !cloud.available) return 0;
  try {
    const res = await pb.collection("rating").getList(1, 1, { filter: `level="${id}" && value>0` });
    return res.totalItems;
  } catch { return 0; }
}

export async function hasRated(id) {
  const u = user();
  if (!pb || !cloud.available || !u) return false;
  try {
    await pb.collection("rating").getFirstListItem(`user="${u.id}" && level="${id}"`);
    return true;
  } catch { return false; }
}

export async function rateLevel(id) {
  const u = user();
  if (!pb || !cloud.available || !u) return false;

  // Fetch the user's existing rating row once (idempotent toggle, no double-fetch race).
  let existing = null;
  try {
    existing = await pb.collection("rating").getFirstListItem(`user="${u.id}" && level="${id}"`);
  } catch { existing = null; }

  if (existing) {
    // Unlike: delete it. If it's already gone (404), treat as not-liked.
    try { await pb.collection("rating").delete(existing.id); } catch { /* already gone */ }
    return false;
  }
  // Like: create the row. On failure, report the unchanged (not-liked) state.
  try {
    await pb.collection("rating").create({ user: u.id, level: id, value: 1 });
    return true;
  } catch { return false; }
}

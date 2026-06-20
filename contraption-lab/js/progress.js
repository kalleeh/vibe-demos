const KEY = "cl.progress";

export function mergeProgress(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id];
    if (!x) { out[id] = y; continue; }
    if (!y) { out[id] = x; continue; }
    const better = (y.bestParts < x.bestParts) || (y.bestParts === x.bestParts && y.bestMs < x.bestMs) ? y : x;
    out[id] = { solved: x.solved || y.solved, bestParts: better.bestParts, bestMs: better.bestMs };
  }
  return out;
}

export function getProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function recordSolve(levelId, parts, ms) {
  const cur = getProgress();
  const incoming = { [levelId]: { solved:true, bestParts:parts, bestMs:ms } };
  const merged = mergeProgress(cur, incoming);
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
  return merged[levelId];
}
export const isSolved = (levelId) => !!getProgress()[levelId]?.solved;

// --- Phase 2: cloud sync shaping (pure) ---

// PB records → local progress map. Each record: {level_id, solved, best_parts, best_ms}.
export function recordsToProgress(records = []) {
  const out = {};
  for (const r of records) {
    out[r.level_id] = { solved: !!r.solved, bestParts: r.best_parts ?? Infinity, bestMs: r.best_ms ?? Infinity };
  }
  return out;
}

// Local progress map → PB record bodies (only solved levels are worth syncing).
export function progressToRecords(map = {}, userId) {
  const rows = [];
  for (const [level_id, e] of Object.entries(map)) {
    if (!e || !e.solved) continue;
    rows.push({ user: userId, level_id, solved: true, best_parts: e.bestParts, best_ms: e.bestMs });
  }
  return rows;
}

// Merge a remote map into local storage (best-of), persist, return merged map.
export function applyRemote(remoteMap = {}) {
  const merged = mergeProgress(getProgress(), remoteMap);
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
  return merged;
}

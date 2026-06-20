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

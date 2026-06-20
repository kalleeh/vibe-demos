export const THEMES = [
  { id:"blueprint", label:"Blueprint" },
  { id:"cartoon",   label:"Cartoon" },
  { id:"neon",      label:"Neon" },
  { id:"toy",       label:"Clean Toy" },
];
const KEY = "cl.theme";
export const loadTheme = () => localStorage.getItem(KEY) || "blueprint";
export function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, id); } catch {}
}
export function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = n => s.getPropertyValue(n).trim();
  return { bg:v("--bg"), ink:v("--ink"), grid:v("--grid"), partFill:v("--part-fill"),
    partStroke:v("--part-stroke"), fixedFill:v("--fixed-fill"), accent:v("--accent"), goal:v("--goal") };
}

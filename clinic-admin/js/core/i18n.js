/* clinic-admin — i18n core (KO primary · EN complete).
   Leaf module: imports only the two dictionaries, so anything from dom.js upward may use it — including the
   lock screen, which runs while the Store is still locked. The choice is therefore NOT a Store key: it lives in
   plain localStorage under the app namespace ("vibe.clinic-admin.ui.lang" — the `ui.*` row of the processing
   register, plaintext by policy, wiped with 전체 파기 like every other ui.* setting).
     getLang()               "ko" | "en"
     setLang(l)              persist → <html lang> → applyStatic(document) → onLangChange listeners (in order)
     t(key, vars?)           current dict → ko → key; `{name}` interpolation; missing key warns once (localhost only)
     tOr(key, fallback)      like t() but returns `fallback` when neither dictionary has the key (data-derived labels)
     pick(obj, field="name") obj[field + "_en"] in EN when present, else obj[field]
     onLangChange(fn)        subscribe (fn(lang)); shell.js registers first, tabs after — so static copy is already
                             swapped when a tab re-fills the dynamic spans inside it
     applyStatic(root)       [data-i18n] → textContent · [data-i18n-html] → innerHTML · [data-i18n-attr="a:k;b:k"]
   `?lang=en|ko` in the URL overrides once and is persisted. The Korean text in index.html stays the source of
   truth; tools/i18n-extract.mjs regenerates the KO entries from it and fails on keys missing from either dict. */
import koBase from "../i18n/ko.js";
import enBase from "../i18n/en.js";
import koEntities from "../i18n/ko.entities.js";
import enEntities from "../i18n/en.entities.js";
import koClaims from "../i18n/ko.claims.js";
import enClaims from "../i18n/en.claims.js";
import koReporting from "../i18n/ko.reporting.js";
import enReporting from "../i18n/en.reporting.js";

/* Dictionaries are split by owner: ko.js/en.js (shell · security · core), *.entities.js (shared entities · org ·
   roster · board), *.claims.js (tabs 01 02 06 07), *.reporting.js (tabs 00 03 04 05 09). Merged flat here;
   tools/i18n-extract.mjs checks every referenced key against the merged set and flags duplicate keys. */
const ko = { ...koBase, ...koEntities, ...koClaims, ...koReporting };
const en = { ...enBase, ...enEntities, ...enClaims, ...enReporting };

const KEY = "vibe.clinic-admin.ui.lang";
const DICT = { ko, en };
const listeners = [];
const warned = new Set();
const DEV = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const valid = (l) => l === "ko" || l === "en";

function persist(l) { try { localStorage.setItem(KEY, l); } catch {} }
function readInitial() {
  let fromUrl = null;
  try { const p = new URLSearchParams(location.search).get("lang"); if (valid(p)) fromUrl = p; } catch {}
  if (fromUrl) { persist(fromUrl); return fromUrl; }
  try { const s = localStorage.getItem(KEY); if (valid(s)) return s; } catch {}
  return "ko";
}
let lang = readInitial();
if (typeof document !== "undefined") document.documentElement.lang = lang;

const interp = (s, vars) => vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : String(s);
function warnOnce(msg, key) { if (DEV && !warned.has(msg + key)) { warned.add(msg + key); console.warn(`i18n: ${msg}`, key); } }

function t(key, vars) {
  let v = DICT[lang][key];
  if (v == null) {
    v = ko[key];
    if (v == null) { warnOnce("missing key", key); return key; }
    if (lang !== "ko") warnOnce(`no "${lang}" entry for`, key);
  }
  return interp(v, vars);
}
const has = (key) => DICT[lang][key] != null || ko[key] != null;
const tOr = (key, fallback, vars) => (has(key) ? t(key, vars) : fallback);
function pick(obj, field = "name") {
  if (!obj) return "";
  if (lang === "en" && obj[field + "_en"] != null && obj[field + "_en"] !== "") return obj[field + "_en"];
  return obj[field] ?? "";
}
const getLang = () => lang;
const isEn = () => lang === "en";
const onLangChange = (fn) => { listeners.push(fn); };

function syncToggles(root = document) {
  root.querySelectorAll(".lang-toggle button[data-lang]").forEach(b => {
    const on = b.dataset.lang === lang;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
  root.querySelectorAll("[data-i18n-attr]").forEach(el => {
    for (const pair of el.getAttribute("data-i18n-attr").split(";")) {
      const i = pair.indexOf(":"); if (i < 0) continue;
      const attr = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
  if (root === document) {
    document.title = t("shell.docTitle");
    const md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute("content", t("shell.metaDescription"));
    syncToggles(document);
  }
}
function setLang(l) {
  if (!valid(l) || l === lang) return;
  lang = l;
  persist(lang);
  document.documentElement.lang = lang;
  applyStatic(document);
  for (const fn of listeners) { try { fn(lang); } catch (e) { console.error(e); } }
}

// First paint: the markup is Korean already — only an EN boot needs the swap (and the toggles need their state).
if (typeof document !== "undefined") {
  if (lang !== "ko") applyStatic(document); else syncToggles(document);
}

export { t, tOr, has, pick, getLang, isEn, setLang, onLangChange, applyStatic, syncToggles, KEY as LANG_KEY };

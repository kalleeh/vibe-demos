---
paths:
  - "*/sw.js"
  - "*/manifest.webmanifest"
  - "sw.js"
  - "manifest.webmanifest"
---

# PWA shell pattern

Every demo (and the root studio landing) ships as an installable PWA. Each demo is its own scoped app — adding it to home screen caches only that demo's files and shows only its name/icon/theme. The root has its own thin shell that does NOT shadow demo subroutes.

Reference implementations: `intake-companion/sw.js` (canonical demo SW), root `sw.js` (root SW with subpath exclusion), `korean-mbti/sw.js` and `kids-bookshelf/sw.js` (demo SWs that never intercept cross-origin requests — the AI proxy, PocketBase, CDN imports).

## Per-demo files

Each `<slug>/` folder has, alongside `index.html`:
- `manifest.webmanifest` — name, short_name, theme/background colors, `lang` (typically `"ko"`), `start_url: "./"`, `scope: "./"`, `display: "standalone"`, single SVG icon `purpose: "any maskable"`.
- `icon.svg` — distinctive editorial glyph per demo (NOT a shared mark).
- `sw.js` — scoped to the demo folder. Cache name `vibe-<slug>-v1`. **Network-first for HTML** (deploys propagate), **cache-first for assets** (instant repeat loads). Never intercept cross-origin requests at all — `if (new URL(req.url).origin !== self.location.origin) return;` — which keeps the AI proxy (`ai.pb.gurum.se`), PocketBase (`*.pb.gurum.se`), and CDN modules out of the cache.

## Per-demo head tags

Inject inside `<head>`, after charset/viewport/title:

```html
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="apple-touch-icon" href="icon.svg">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="<demo theme color>">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="<black-translucent | default>">
<meta name="apple-mobile-web-app-title" content="<short title>">
```

## Service worker registration

Inject before `</body>`:

```html
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
</script>
```

## Root SW must not shadow demo SWs

The root `sw.js` is scoped to `./` (the whole deployment). Its `fetch` handler skips any path containing `/` after the scope root — except the landing's own `thumbs/` folder and a small `LANDING_CROSSDEMO` allow-list (e.g. `tinywings/assets/hero-mood.webp`) — so a demo subroute is handled exclusively by that demo's SW once registered:

```js
const root = new URL(self.registration.scope);
const path = url.pathname.slice(root.pathname.length);
if (path.includes("/") && !path.startsWith("thumbs/") && !LANDING_CROSSDEMO.has(path)) return;
```

## Cache invalidation

When a demo ships a meaningful change, bump its cache name (`vibe-<slug>-v1` → `v2`). The activate handler already deletes caches that don't match the current name. Same rule for the root: thumbs are cache-first, so bump root `sw.js` `CACHE` (`vibe-root-vN`) whenever a thumb is added, renamed, or regenerated, and keep its `SHELL` list in sync with the works index.

## First-load mismatch after deploys (cache-first assets)

If HTML is network-first but JS/CSS/JSON are cache-first, the FIRST load after a deploy runs fresh HTML against the previous cache's scripts (the old SW still controls the page until the new one activates). Symptoms: raw i18n keys (`nav.*`), missing handlers, layout glitches that vanish on reload. For any demo whose HTML and JS change together (all i18n'd or module-split demos), serve same-origin assets network-first with cache fallback (see `clinic-admin/sw.js`), or version asset URLs. Bumping `CACHE` alone does not prevent this.

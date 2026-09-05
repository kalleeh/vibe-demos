# changwon-homes data pipeline

Build-time only. Nothing here ships to the browser; the page fetches the baked
`../data.json`. All scripts are Python 3 stdlib (no pip installs).

## Run order

```sh
cd changwon-homes

# 1. parse raw MOLIT exports → one record per complex × 평형-band
python3 scripts/parse_molit.py 'data/raw/*.xlsx' > data/complexes.json

# 2. attach lat/lng (AWS Location / Esri, cached in data/geocache.json)
python3 scripts/geocode.py data/complexes.json [INDEX_NAME] [REGION] \
        [--reuse=data/complexes.geo.json] > data/complexes.geo.json

# 3. bake the browser payload (meta.period is derived from the data; pass a
#    second arg to override the label)
python3 scripts/bake_data.py data/complexes.geo.json > data.json

# then bump CACHE in ../sw.js so installed PWAs pick up the new data.json
```

Separately, `hedonic.py` is the regression that justifies the coefficients
hard-coded in `bake_data.py` (`meta.hedonic`). It reads the raw 매매 xlsx +
`data/geocache.json` directly and prints an OLS table:

```sh
python3 scripts/hedonic.py
```

Re-run it and paste the rounded coefficients into `bake_data.py` whenever the
raw data or `BRAND_TOKENS` change. `hedonic.py` imports `BRAND_TOKENS` from
`parse_molit.py` so the regression's brand dummy and the baked `brand` flag
can never drift apart.

## Inputs

- `data/raw/molit_<gu>.xlsx` — 아파트(매매) exports from
  [rt.molit.go.kr](https://rt.molit.go.kr/) (공공데이터 · 출처표시), one per 구.
- `data/raw/molit_jeonse_<gu>.xlsx` — 아파트(전월세) exports, one per 구.
  Both file types are auto-detected from the header row.

## Prerequisites

- Python 3.10+.
- Step 2 only: the AWS CLI with credentials and an **AWS Location place index
  created with the Esri data source**, e.g.
  `aws location create-place-index --index-name changwon-esri --data-source Esri`
  (defaults: index `changwon-esri`, region `eu-north-1`). Every result is cached
  in `data/geocache.json`, so re-runs on unchanged addresses need no network.
  `--reuse=PREV.geo.json` additionally copies coordinates for a known
  (name, 구, 동) whose 도로명 string changed, letting a re-bake run fully offline.
- Steps 1 and 3 and `hedonic.py` need no network at all.

## Verifying the client's pure scoring functions

```sh
node tools/fairprice.test.mjs
```

extracts the `==PURE-BEGIN== … ==PURE-END==` block from `../index.html` and
unit-tests `clamp`, `priceScore` and `fairPrice`.

## About `pb/`

`../pb/pb_migrations/` defines a private, auth-gated PocketBase **file-drop
chute** used to get MOLIT exports from a phone onto the build machine
(`../upload.html` is its front-end). It is part of the data-build pipeline
only — the live demo never talks to PocketBase.

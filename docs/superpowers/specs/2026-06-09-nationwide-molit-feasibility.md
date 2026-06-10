# Nationwide live MOLIT data — feasibility findings (2026-06-09)

**Question:** can `changwon-homes` scale to "live-updating homes all over Korea"?
**Verdict:** YES, technically unblocked. The only non-engineering gate is obtaining a
data.go.kr `serviceKey` (requires a Korean phone / I-PIN / 외국인등록번호 — see "Account").

All findings below were verified empirically from the sandbox on 2026-06-09 unless noted.

---

## 1. Reachability — CLEARED ✅

The make-or-break risk (sandbox + server are IP-blocked from MOLIT) is resolved:
the **API gateway `apis.data.go.kr` is reachable** even though the human web portals
are not.

| Host | Sandbox | pb-backends | Note |
|------|---------|-------------|------|
| `apis.data.go.kr` (REST API) | ✅ 401 Unauthorized | ✅ 401 (connect 0.28s) | reachable; 401 = needs key, NOT a block |
| `www.data.go.kr` (portal) | ❌ 000 | — | blocked; irrelevant (we use the API) |
| `rt.molit.go.kr` (file portal) | ❌ 000 | — | blocked; this is why Changwon used manual upload |
| `code.go.kr` (행정표준코드 portal) | ❌ 000 | — | blocked; LAWD list comes from API or static bake |
| `api.vworld.kr` (geocoder) | 502 (up) | ❌ 000 | unreliable → DO NOT use; keep Esri/AWS Location |

**Key insight:** `401 Unauthorized` is an application-layer response from the gateway —
TCP/TLS/routing all succeeded. A valid `serviceKey` turns it into data. The cron fetch
can run directly on the existing `pb-backends` Lightsail box (eu-north-1); no
Korea-region instance or proxy needed.

## 2. Endpoint names — CONFIRMED current ✅

Probed by keyless routing: a **real** endpoint returns `401 "Unauthorized"`; a **bogus**
path returns `500 "Unexpected errors"`. Decisive negative control. All under service id
`1613000`:

| Property type | Endpoint path |
|---|---|
| 아파트 매매 (detail) | `1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev` |
| 아파트 매매 (basic) | `1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade` |
| 아파트 전월세 | `1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent` |
| 오피스텔 매매 | `1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade` |
| 오피스텔 전월세 | `1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent` |
| 연립·다세대 매매 | `1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade` |
| 단독·다가구 매매 | `1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade` |

Auth is checked BEFORE param validation (401 even with LAWD_CD/key both missing).

### Request params (all endpoints)
- `serviceKey` — the data.go.kr key (Decoding key when the client URL-encodes; Encoding key if pasted raw)
- `LAWD_CD` — 5-digit 시군구 code (e.g. 11110 = 종로구). **~250 codes nationwide.**
- `DEAL_YMD` — 6-digit 계약년월 (e.g. 202604)
- `pageNo`, `numOfRows` — pagination
- `_type=json` — optional; default response is XML

### 매매 response fields (verified vs current docs — match `parse_molit.py`)
`dealAmount`(거래금액 만원) · `excluUseAr`(전용면적 ㎡) · `buildYear`(건축년도) ·
`floor`(층) · `umdNm`(법정동) · `aptNm`(아파트) · `dealYear`/`dealMonth`/`dealDay`

### 전월세 response fields — NOT fully confirmed (needs a key)
Expected to add `deposit`(보증금액) + `monthlyRent`(월세금액) alongside the same
area/floor/year fields. Web docs are on the blocked portal; confirm against a live
response once a key exists. (Changwon's existing 월세 model already expects 보증금/월세금.)

## 3. Nationwide iteration

- **법정동코드 (LAWD_CD) list:** ~250 시군구. Source options: `StanReginCd` API
  (`1741000/StanReginCd/getStanReginCdList`, reachable, 401) OR just bake the ~250 codes
  statically (they almost never change). Prefer the static bake.
- **Call volume:** ~250 codes × N trailing months × (sale + rent) × pages. A daily
  trailing-3-month refresh ≈ 250 × 3 × 2 × (~a few pages) = low thousands of calls/day.
- **Quota:** free dev tier is commonly cited as ~10,000 calls/day per key — **UNVERIFIED**
  (couldn't confirm without an account). If the trailing-window pull exceeds it, shard
  the refresh across days or request a quota bump (운영계정 신청).

## 4. "Live" caveat (set expectations)

MOLIT is **filed within ~30 days** of contract → inherent reporting lag. "Live" realistically
= a **daily cron that re-pulls the trailing few months** and folds in newly-filed deals.
Daily-moving *asking* prices (KB/네이버) are a separate, ToS-gray scraping project — out of scope.

## 5. Account — the one real gate (user action)

data.go.kr signup requires 본인인증 via **Korean mobile OR I-PIN**. Foreigners can register
**only with an 외국인등록번호 (ARC)** (→ issues an I-PIN). With **no Korean ID at all, there is
no documented signup path.**

**Recommended unblock — borrow a KEY, not an account:** the `serviceKey` is just a string and
MOLIT APIs are rate-limited per-key, not per-identity. Anyone with a Korean phone (friend/
colleague) can register, 활용신청 the 2 apt APIs (usually auto-approved), and hand over the key.
It then lives as a **0600 systemd env drop-in** on `pb-backends` (same secret pattern as the AI
proxy — `$os.getenv`), never in the repo.

**Fallback needing nobody:** the `rt.molit.go.kr` bulk Excel/CSV download (no key) — exactly the
Changwon manual route — re-uploaded periodically via the **already-built upload chute**
(`changwon-homes/upload.html` → PocketBase). "Regularly updated," not "live."

---

## Proposed architecture (once a key exists)

```
cron on pb-backends (daily)
  → fetch apis.data.go.kr: ~250 LAWD_CD × trailing N months × {AptTradeDev, AptRent}
  → geocode only NEW complexes (Esri/AWS Location; cache the rest — geocache.json)
  → run hedonic.py + value scoring (UNCHANGED — just more rows)
  → write sharded static JSON per 시도/시군구  (NOT one national blob — too big for Pages)
  → frontend loads shards on demand by map viewport / 시군구 selection
```

Reuses unchanged: `geocode.py` (+ Esri index `changwon-esri`), `hedonic.py`, `bake_data.py`
core, `valueScore`/`peersOf`, the upload chute, `sync-backends.sh`, cron tooling.
New work: an API fetcher (replaces `parse_molit.py`'s xlsx read), JSON sharding, viewport-
based frontend loading.

## Next steps
1. **User:** obtain a data.go.kr `serviceKey` (borrow via a Korean phone, or fallback to file upload).
2. **Then:** one-city API spike (e.g. 부산 한 구) to confirm the 전월세 field names + real quota end-to-end.
3. **Then:** generalize fetcher → sharding → viewport loading → nationwide.

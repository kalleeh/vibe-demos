#!/usr/bin/env python3
"""
geocode.py — attach lat/lng to each complex in complexes.json.

Build-time only. Uses AWS Location Service (Esri provider) via the AWS CLI —
NOT a browser dependency and NOT shipped. Chosen over Nominatim because the
public Nominatim server hard-rate-limits (429) bulk geocoding from a single
IP, whereas AWS Location has no such per-IP throttle and Esri geocodes Korean
도로명주소 at street level accurately (verified on all five Changwon 구).

Requires: a place-index created with the Esri data source, e.g.
    aws location create-place-index --index-name changwon-esri --data-source Esri
and `aws` configured with credentials + region.

Strategy:
  1. Esri geocode on "경상남도 창원시 <구> <동> <road>"  (동 included to disambiguate)
  2. cache every result to data/geocache.json (keyed by the query) so reruns
     are instant and we don't re-bill / re-query.
  3. centroid fallback (동 → 구) for the rare genuine miss.

Output: complexes.geo.json (records + lat/lng + geo_src).

Usage:
    python3 geocode.py data/complexes.json [INDEX_NAME] [REGION] > data/complexes.geo.json
"""
import sys, os, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "..", "data", "geocache.json")

GU_CENTROID = {
    "성산구":   (35.2210, 128.6810),
    "의창구":   (35.2540, 128.6420),
    "마산회원구":(35.2230, 128.5790),
    "마산합포구":(35.1860, 128.5640),
    "진해구":   (35.1340, 128.7050),
}

def load_cache():
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_cache(c):
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(c, f, ensure_ascii=False, indent=0)

def esri_geocode(text, index, region):
    """Return (lat, lng) | None. Raises on CLI/transport failure so the
    caller doesn't cache a transient error as a genuine miss."""
    out = subprocess.run(
        ["aws", "location", "search-place-index-for-text",
         "--index-name", index, "--text", text,
         "--language", "ko", "--max-results", "1",
         "--region", region, "--output", "json"],
        capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip()[:200])
    data = json.loads(out.stdout)
    res = data.get("Results", [])
    if not res:
        return None
    pt = res[0].get("Place", {}).get("Geometry", {}).get("Point")
    if not pt:
        return None
    lng, lat = pt[0], pt[1]            # AWS returns [lon, lat]
    # sanity: must be within Changwon-ish bbox, else treat as a bad match
    if not (34.9 < lat < 35.5 and 128.3 < lng < 129.0):
        return None
    return (lat, lng)

def main(path, index, region):
    cx = json.load(open(path, encoding="utf-8"))
    cache = load_cache()
    hits = misses = cached = 0

    for i, c in enumerate(cx):
        road = (c.get("road") or "").strip()
        gu, dong = c["gu"], c["dong"]
        key = None
        if road and road != "-":
            key = f"경상남도 창원시 {gu} {dong} {road}"

        coord = None
        if key and key in cache:
            coord = cache[key]; cached += 1
        elif key:
            try:
                coord = esri_geocode(key, index, region)
                cache[key] = coord     # cache genuine None too (don't re-query)
            except Exception as e:
                sys.stderr.write(f"  ! {key}: {e}\n")
                coord = None           # transient — do NOT cache
            if i % 25 == 0:
                save_cache(cache)

        if coord:
            c["lat"], c["lng"] = coord[0], coord[1]
            c["geo_src"] = "esri"
            hits += 1
        else:
            c["lat"], c["lng"] = None, None
            c["geo_src"] = "pending"
            misses += 1

        if i % 100 == 0:
            sys.stderr.write(f"  …{i}/{len(cx)} (hit {hits}, miss {misses}, cached {cached})\n")

    save_cache(cache)

    # ---- centroid fallback for genuine misses ----
    dong_pts = {}
    for c in cx:
        if c["lat"] is not None:
            dong_pts.setdefault((c["gu"], c["dong"]), []).append((c["lat"], c["lng"]))
    def centroid(pts):
        return (sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts))

    filled = 0
    for c in cx:
        if c["lat"] is None:
            pts = dong_pts.get((c["gu"], c["dong"]))
            if pts:
                c["lat"], c["lng"] = centroid(pts); c["geo_src"] = "dong-centroid"
            else:
                c["lat"], c["lng"] = GU_CENTROID.get(c["gu"], (35.22, 128.62))
                c["geo_src"] = "gu-centroid"
            filled += 1

    sys.stderr.write(
        f"geocoded {len(cx)}: esri/cache {hits}, centroid-filled {filled}\n")
    print(json.dumps(cx, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: geocode.py complexes.json [index] [region] > out.json")
    idx = sys.argv[2] if len(sys.argv) > 2 else "changwon-esri"
    reg = sys.argv[3] if len(sys.argv) > 3 else "eu-north-1"
    main(sys.argv[1], idx, reg)

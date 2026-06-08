#!/usr/bin/env python3
"""
bake_data.py — turn complexes.geo.json into the final data.json the browser
fetches. Build-time only.

Output shape (one record per complex; the frontend computes value scores
client-side so it can recompute live when the 매매/전세 toggle flips — same as
the original synthetic demo did):

{
  "meta": { "source": "...", "period": "...", "generated": "...",
            "deals": {"sale":N,"jeonse":N}, "complexes": N },
  "complexes": [
    { "name","gu","dong","built","lat","lng","dealCount",
      "sizes": [ {"pyeong":26,"area_m2":84.9,"sale":6.9,"jeonse":4.7,"n":183}, ... ] },
    ...
  ]
}

Prices are 억 (10k-만원). sale/jeonse may be null for a band that only traded
one way. Bands with neither are dropped upstream by parse_molit.py.

Usage:
    python3 bake_data.py data/complexes.geo.json [period] > data.json
"""
import sys, json

def main(path, period):
    cx = json.load(open(path, encoding="utf-8"))

    out = []
    n_sale = n_jeo = 0
    for c in cx:
        sizes = []
        for band, s in sorted(c["sizes"].items(), key=lambda kv: int(kv[0])):
            row = {
                "pyeong": s["pyeong"],
                "area_m2": s["area_m2"],
                "n": s["n"],
            }
            if "sale" in s:   row["sale"] = s["sale"];   n_sale += 1
            if "jeonse" in s: row["jeonse"] = s["jeonse"]; n_jeo += 1
            sizes.append(row)
        if not sizes:
            continue
        out.append({
            "name": c["name"], "gu": c["gu"], "dong": c["dong"],
            "built": c["built"],
            "lat": round(c["lat"], 6), "lng": round(c["lng"], 6),
            "dealCount": c["deal_count"],
            "geoSrc": c.get("geo_src"),
            "sizes": sizes,
        })

    data = {
        "meta": {
            "source": "국토교통부 실거래가 공개시스템 (rt.molit.go.kr)",
            "period": period,
            "note": "거래 실데이터. 좌표는 도로명주소 지오코딩(AWS Location/Esri).",
            "complexes": len(out),
            "sizeBands": sum(len(c["sizes"]) for c in out),
            "bandsWithSale": n_sale,
            "bandsWithJeonse": n_jeo,
        },
        "complexes": out,
    }
    sys.stderr.write(
        f"baked {len(out)} complexes, {data['meta']['sizeBands']} bands "
        f"(sale {n_sale}, jeonse {n_jeo})\n")
    print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: bake_data.py complexes.geo.json [period] > data.json")
    period = sys.argv[2] if len(sys.argv) > 2 else "2025-06 ~ 2026-06 (계약일 기준)"
    main(sys.argv[1], period)

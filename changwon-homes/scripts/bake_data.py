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

    # 신도시 cores (hedonic: each km from nearest core ≈ -7.3% 평단가)
    import math
    CORE = [(35.232079, 128.681025),   # 용지호수공원 (성산 신도시)
            (35.256943, 128.626998)]   # 중동 유니시티 (의창 신도시)
    def dist_core(lat, lng):
        return round(min(math.hypot((lat-cy)*111, (lng-cx)*89) for cy, cx in CORE), 2)

    out = []
    n_sale = n_jeo = n_wol = 0
    for c in cx:
        sizes = []
        for band, s in sorted(c["sizes"].items(), key=lambda kv: int(kv[0])):
            row = {
                "pyeong": s["pyeong"],
                "area_m2": s["area_m2"],
                "n": s["n"],
            }
            if s.get("medFloor") is not None: row["floor"] = s["medFloor"]
            if "sale" in s:   row["sale"] = s["sale"];   n_sale += 1
            if "jeonse" in s: row["jeonse"] = s["jeonse"]; n_jeo += 1
            if "wMonthly" in s:                          # 월세: deposit(억)+monthly(만원)
                row["wDep"] = s["wDeposit"]; row["wMon"] = s["wMonthly"]; n_wol += 1
            sizes.append(row)
        if not sizes:
            continue
        out.append({
            "name": c["name"], "gu": c["gu"], "dong": c["dong"],
            "built": c["built"],
            "lat": round(c["lat"], 6), "lng": round(c["lng"], 6),
            "dealCount": c["deal_count"],
            "brand": bool(c.get("brand")),
            "maxFloor": c.get("maxFloor"),
            "dcore": dist_core(c["lat"], c["lng"]),
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
            "bandsWithWolse": n_wol,
            # 전월세전환율: derived from 4,443 전세↔월세 pairs in this dataset
            # (median implied annual rate). Used to compute 환산월세 for the
            # 월세 comparison: monthly + deposit*rate/12.
            "wolseConvRate": 0.052,
            # Hedonic coefficients measured on 12,720 sale deals (scripts/hedonic.py,
            # R²=0.69, all *** p<0.01). DV = log(만원/평). Used for transparent
            # factor chips + as priors for the model. % ≈ coef×100.
            "hedonic": {
                "r2": 0.69, "n": 12720,
                "distCorePerKm": -0.073,   # -7.3% 평단가 per km from 신도시 core
                "brand": 0.136,            # +13.6% for 1군 brand
                "agePerYear": -0.041,      # -4.1%/yr (flattens; no redevelopment U here)
                "floorLow": -0.037,        # 저층 -3.7%
                "floorTop": -0.091,        # 탑층 -9.1%
            },
        },
        "complexes": out,
    }
    sys.stderr.write(
        f"baked {len(out)} complexes, {data['meta']['sizeBands']} bands "
        f"(sale {n_sale}, jeonse {n_jeo}, wolse {n_wol})\n")
    print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: bake_data.py complexes.geo.json [period] > data.json")
    period = sys.argv[2] if len(sys.argv) > 2 else "2025-06 ~ 2026-06 (계약일 기준)"
    main(sys.argv[1], period)

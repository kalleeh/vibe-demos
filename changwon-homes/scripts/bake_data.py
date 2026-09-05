#!/usr/bin/env python3
"""
bake_data.py — turn complexes.geo.json into the final data.json the browser
fetches. Build-time only.

Output shape (one record per complex; the frontend computes value scores
client-side so it can recompute live when the 매매/전세 toggle flips — same as
the original synthetic demo did):

{
  "meta": { "source", "sourceUrl", "license",
            "period" (derived from the data's contract months unless overridden on the CLI),
            "generated" (UTC date of this bake),
            "deals": {"sale":N,"jeonse":N,"wolse":N}, "complexes": N, "bands": N,
            "bandsWithSale"/"bandsWithJeonse"/"bandsWithWolse", "wolseConvRate",
            "hedonic": {...} },
  "complexes": [
    { "name","gu","dong","built","lat","lng","dealCount","saleCount","brand","maxFloor","dcore","trend",
      "sizes": [ {"pyeong":26,"area_m2":84.9,"n":183,"floor":9,
                  "sale":6.9,"saleN":40,"saleYm":"2026-05","saleMed":6.8,
                  "hist":[["2025-07",2650,3],["2025-09",2700,1],...],   # monthly median 평단가 (만원/평) + n
                  "jeonse":4.7,"jeonseN":22,"jeonseYm":"2026-04",
                  "wDep":0.5,"wMon":60,"wolseN":8,"wolseYm":"2026-03"}, ... ] },
    ...
  ]
}

Prices are 억 (10k-만원). A band carries only the modes it actually traded in.
Bands with no price in any mode are dropped upstream by parse_molit.py.

Usage:
    python3 bake_data.py data/complexes.geo.json [period] > data.json
"""
import sys, json, datetime

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
    deals = {"sale": 0, "jeonse": 0, "wolse": 0}
    ym_min = ym_max = None
    for c in cx:
        sizes = []
        for band, s in sorted(c["sizes"].items(), key=lambda kv: int(kv[0])):
            row = {
                "pyeong": s["pyeong"],
                "area_m2": s["area_m2"],
                "n": s["n"],
            }
            if s.get("medFloor") is not None: row["floor"] = s["medFloor"]
            if "sale" in s:
                row["sale"] = s["sale"]; n_sale += 1
                if "sale_n" in s:   row["saleN"] = s["sale_n"]
                if "sale_ym" in s:  row["saleYm"] = s["sale_ym"]
                if "sale_med" in s: row["saleMed"] = s["sale_med"]
                if s.get("sale_hist"): row["hist"] = s["sale_hist"]   # [[YYYY-MM, 만원/평, n], ...]
            if "jeonse" in s:
                row["jeonse"] = s["jeonse"]; n_jeo += 1
                if "jeonse_n" in s:  row["jeonseN"] = s["jeonse_n"]
                if "jeonse_ym" in s: row["jeonseYm"] = s["jeonse_ym"]
            if "wMonthly" in s:                          # 월세: deposit(억)+monthly(만원)
                row["wDep"] = s["wDeposit"]; row["wMon"] = s["wMonthly"]; n_wol += 1
                if "wolse_n" in s:  row["wolseN"] = s["wolse_n"]
                if "wolse_ym" in s: row["wolseYm"] = s["wolse_ym"]
            sizes.append(row)
        if not sizes:
            continue
        for k in deals:
            deals[k] += c.get(k + "_count", 0)
        if c.get("ym_min"):
            ym_min = c["ym_min"] if ym_min is None else min(ym_min, c["ym_min"])
            ym_max = c["ym_max"] if ym_max is None else max(ym_max, c["ym_max"])
        out.append({
            "name": c["name"], "gu": c["gu"], "dong": c["dong"],
            "built": c["built"],
            "lat": round(c["lat"], 6), "lng": round(c["lng"], 6),
            "dealCount": c["deal_count"],
            "saleCount": c.get("sale_count"),   # 매매 only; dealCount is 매매+전월세
            "brand": bool(c.get("brand")),
            "maxFloor": c.get("maxFloor"),
            "dcore": dist_core(c["lat"], c["lng"]),
            "trend": c.get("trend"),    # YoY % change in median 평단가 (sale), or null
            "sizes": sizes,
        })

    if not period:
        fmt = lambda ym: f"{ym[:4]}-{ym[4:6]}"
        period = f"{fmt(ym_min)} ~ {fmt(ym_max)} (계약일 기준)" if ym_min else "-"

    data = {
        "meta": {
            "source": "국토교통부 실거래가 공개시스템 (rt.molit.go.kr)",
            "sourceUrl": "https://rt.molit.go.kr/",
            # rt.molit.go.kr publishes no explicit 공공누리 type on its landing page
            # (checked 2026-09-05: footer is a plain copyright line), so we attribute
            # as public data with source marking rather than claim a KOGL class.
            "license": "공공데이터 · 출처표시",
            "period": period,
            "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
            "note": "거래 실데이터. 좌표는 도로명주소 지오코딩(AWS Location/Esri).",
            "complexes": len(out),
            "bands": sum(len(c["sizes"]) for c in out),
            "deals": deals,          # contract counts by type over the whole period
            "bandsWithSale": n_sale,
            "bandsWithJeonse": n_jeo,
            "bandsWithWolse": n_wol,
            # 전월세전환율: derived from 4,443 전세↔월세 pairs in this dataset
            # (median implied annual rate). Used to compute 환산월세 for the
            # 월세 comparison: monthly + deposit*rate/12.
            "wolseConvRate": 0.052,
            # Hedonic coefficients measured on 12,720 sale deals (scripts/hedonic.py,
            # R²=0.69, all *** p<0.01). DV = log(만원/평). Used for transparent
            # factor chips + the client's fair-price estimate. % ≈ coef×100.
            # Re-run `python3 scripts/hedonic.py` and paste the rounded coefs here
            # whenever the raw data or BRAND_TOKENS change (last: 2026-09-05, with
            # the brand list shared from parse_molit.py).
            "hedonic": {
                "r2": 0.69, "n": 12720,
                "distCorePerKm": -0.073,   # -7.3% 평단가 per km from 신도시 core
                "brand": 0.134,            # +13.4% for 1군 brand
                "agePerYear": -0.040,      # -4.0%/yr (flattens; no redevelopment U here)
                "floorLow": -0.036,        # 저층 -3.6%
                "floorTop": -0.089,        # 탑층 -8.9%
            },
        },
        "complexes": out,
    }
    sys.stderr.write(
        f"baked {len(out)} complexes, {data['meta']['bands']} bands "
        f"(sale {n_sale}, jeonse {n_jeo}, wolse {n_wol}) · period {period}\n")
    print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: bake_data.py complexes.geo.json [period] > data.json")
    period = sys.argv[2] if len(sys.argv) > 2 else None   # None → derived from the data
    main(sys.argv[1], period)

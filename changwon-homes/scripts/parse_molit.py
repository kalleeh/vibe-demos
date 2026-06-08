#!/usr/bin/env python3
"""
parse_molit.py — build-time aggregator for MOLIT 실거래가 exports.

Handles BOTH file types, auto-detected from the header row:
  - 아파트(매매)   : sale deals       → 거래금액(만원)
  - 아파트(전월세) : rent contracts   → 전월세구분 / 보증금(만원) / 월세금(만원)

NOT shipped to the browser. stdlib only (no openpyxl) — MOLIT uses inline
strings in xl/worksheets/sheet1.xml.

Aggregation: group by 단지명 + 법정동. Within a complex, per 평-band keep the
LATEST contract for each of: sale price, 전세 deposit. (월세 rows are counted
but not priced — the demo compares sale vs 전세.)

Output: complexes.json — one record per complex with:
  name, gu, dong, road, built, deal_count,
  sizes: { band: { pyeong, area_m2, sale?, jeonse?, sale_ym?, jeonse_ym?, n } }

Usage:
    python3 parse_molit.py data/raw/*.xlsx > data/complexes.json
"""
import sys, re, html, json, zipfile, glob

def cells(rowxml):
    out = []
    for c in re.findall(r"<c[^>]*>(.*?)</c>", rowxml, re.S):
        m = re.search(r"<t[^>]*>(.*?)</t>", c, re.S) or re.search(r"<v>(.*?)</v>", c, re.S)
        out.append(html.unescape(m.group(1)) if m else "")
    return out

def read_rows(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "replace")
    return [cells(r) for r in re.findall(r"<row[^>]*>(.*?)</row>", xml, re.S)]

def find_header(rows):
    for i, v in enumerate(rows):
        if v and v[0] == "NO":
            return i, v
    return None, None

def col_index(header):
    """Map by Korean column label so we tolerate schema differences."""
    idx = {}
    for i, h in enumerate(header):
        idx[h] = i
    return idx

def pyeong(area_m2):
    try: return float(area_m2) / 3.305785
    except (ValueError, TypeError): return None

def eok(manwon):
    try: return int(str(manwon).replace(",", "")) / 10000.0
    except (ValueError, TypeError): return None

def gu_dong(sigungu):
    parts = sigungu.split()
    gu = next((p for p in parts if p.endswith("구")), "")
    dong = parts[-1] if parts else ""
    return gu, dong

def get(row, idx, label):
    i = idx.get(label)
    return row[i] if i is not None and i < len(row) else ""

# Floor price multipliers measured by hedonic regression on these transactions
# (scripts/hedonic.py): 저층 (rel<0.15 or floor<=2) ≈ -3.7%, 탑층 (rel>=0.92) ≈ -9.1%,
# else baseline. We DIVIDE an observed price by its multiplier to normalize the
# unit to a "standard floor", so floor stops contaminating the value comparison.
def floor_mult(floor, maxfloor):
    if floor is None or not maxfloor:
        return 1.0
    rel = floor / max(maxfloor, 3)
    if floor <= 2 or rel < 0.15:
        return 0.963          # 저층
    if rel >= 0.92 and maxfloor >= 5:
        return 0.909          # 탑층
    return 1.0                # 기준층

def _latest(txns):
    """txns: list of tuples with ym first. Return the max-ym tuple, or None."""
    return max(txns, key=lambda t: t[0]) if txns else None

# 1군 construction brands (hedonic-measured +13.6% premium). Substring match on
# 단지명. Kept tight — only unambiguous brand tokens (no loose "센트럴" etc.).
BRAND_TOKENS = ["자이","래미안","푸르지오","아이파크","더샵","힐스테이트",
                "이편한세상","e편한세상","롯데캐슬","sk뷰","위브","데시앙",
                "꿈에그린","한라비발디","코오롱하늘채","유니시티","베르디움",
                "스위첸","아스트룸","포레나","트리마제"]
def is_brand(name):
    low = name.lower()
    return any(b.lower() in low for b in BRAND_TOKENS)

def finalize(complexes):
    """Turn the per-band transaction lists into floor-normalized headline
    prices. Keeps the LATEST contract per mode, but normalizes its price for
    floor so a band's 시세 reflects a standard-floor unit, not whichever floor
    happened to trade last."""
    import statistics
    for c in complexes:
        mf = c.get("_maxfloor", 0)
        c.pop("_maxfloor", None)
        c["brand"] = is_brand(c["name"])
        c["maxFloor"] = mf or None
        # ---- complex-level price trend (sale only) ----
        # Collect dated, size-normalized 평단가 across all bands, split the year
        # into earlier/recent halves, compare medians. More robust than any
        # single band; only reported when both halves have enough deals.
        trend_pts = []  # (yyyymm, 평단가 만원)
        for s in c["sizes"].values():
            for (ym, price, fl) in s.get("_sale", []):
                ppp = price * 10000 / s["pyeong"]      # 만원/평
                trend_pts.append((ym[:6], ppp))
        c["trend"] = None
        if len(trend_pts) >= 6:
            yms = sorted(set(p[0] for p in trend_pts))
            mid = yms[len(yms)//2]
            earlier = [p[1] for p in trend_pts if p[0] < mid]
            recent  = [p[1] for p in trend_pts if p[0] >= mid]
            if len(earlier) >= 2 and len(recent) >= 2:
                e, r = statistics.median(earlier), statistics.median(recent)
                if e > 0:
                    c["trend"] = round((r - e) / e * 100, 1)   # % change
        for s in c["sizes"].values():
            floors = s.pop("_floors", [])
            s["medFloor"] = int(statistics.median(floors)) if floors else None
            # sale
            t = _latest(s.pop("_sale", []))
            if t:
                ym, price, fl = t
                s["sale"] = round(price / floor_mult(fl, mf), 2)
                s["saleRaw"] = round(price, 2)
            # jeonse
            t = _latest(s.pop("_jeonse", []))
            if t:
                ym, dep, fl = t
                s["jeonse"] = round(dep / floor_mult(fl, mf), 2)
            # wolse (normalize deposit; monthly left as-is — floor effect is small)
            t = _latest(s.pop("_wolse", []))
            if t:
                ym, dep, mon, fl = t
                s["wDeposit"] = round(dep, 2)
                s["wMonthly"] = mon

def main(paths):
    complexes = {}
    n_sale = n_jeonse = n_wolse = 0

    for path in paths:
        rows = read_rows(path)
        hi, header = find_header(rows)
        if hi is None:
            sys.stderr.write(f"  ! {path}: no header row, skipped\n"); continue
        idx = col_index(header)
        is_rent = "전월세구분" in idx
        data = rows[hi + 1:]

        for row in data:
            if not row or not row[0] or not re.match(r"^\d", row[0]):
                continue
            name = get(row, idx, "단지명").strip()
            sig  = get(row, idx, "시군구")
            gu, dong = gu_dong(sig)
            if not name or not gu:
                continue
            pg = pyeong(get(row, idx, "전용면적(㎡)"))
            if pg is None:
                continue
            band = int(round(pg))
            ym = get(row, idx, "계약년월") + get(row, idx, "계약일").zfill(2)
            try:
                b = get(row, idx, "건축년도")
                built = int(b) if b and b != "-" else None
            except ValueError:
                built = None
            road = get(row, idx, "도로명")

            key = f"{name}|{gu}|{dong}"
            cx = complexes.setdefault(key, {
                "name": name, "gu": gu, "dong": dong,
                "road": road, "built": built, "sizes": {}, "deal_count": 0,
            })
            cx["deal_count"] += 1
            if built and not cx["built"]: cx["built"] = built
            if road and (not cx["road"] or cx["road"] == "-"): cx["road"] = road

            try:
                floor = int(get(row, idx, "층"))
            except ValueError:
                floor = None

            slot = cx["sizes"].setdefault(band, {
                "pyeong": round(pg, 1),
                "area_m2": round(float(get(row, idx, "전용면적(㎡)")), 2),
                "n": 0,
                # transaction lists for floor-normalized aggregation (finalized later)
                "_sale": [], "_jeonse": [], "_wolse": [], "_floors": [],
            })
            slot["n"] += 1
            if floor is not None:
                slot["_floors"].append(floor)
                cx["_maxfloor"] = max(cx.get("_maxfloor", 0), floor)

            if is_rent:
                kind = get(row, idx, "전월세구분")
                deposit = eok(get(row, idx, "보증금(만원)"))   # 억
                mon_raw = get(row, idx, "월세금(만원)").replace(",", "").strip()
                try:
                    monthly = int(mon_raw) if mon_raw not in ("", "-") else 0
                except ValueError:
                    monthly = 0
                is_jeonse = (monthly == 0) or kind == "전세"
                if is_jeonse and deposit is not None:
                    n_jeonse += 1
                    slot["_jeonse"].append((ym, deposit, floor))
                elif deposit is not None and monthly > 0:
                    n_wolse += 1
                    slot["_wolse"].append((ym, deposit, monthly, floor))
                else:
                    n_wolse += 1
            else:
                price = eok(get(row, idx, "거래금액(만원)"))
                if price is not None:
                    n_sale += 1
                    slot["_sale"].append((ym, price, floor))

    out = list(complexes.values())
    finalize(out)
    # drop size bands with no price in any mode (sale / jeonse / wolse)
    for c in out:
        c["sizes"] = {b: s for b, s in c["sizes"].items()
                      if "sale" in s or "jeonse" in s or "wMonthly" in s}
    out = [c for c in out if c["sizes"]]

    bands = sum(len(c["sizes"]) for c in out)
    with_sale = sum(1 for c in out for s in c["sizes"].values() if "sale" in s)
    with_jeo  = sum(1 for c in out for s in c["sizes"].values() if "jeonse" in s)
    with_wol  = sum(1 for c in out for s in c["sizes"].values() if "wMonthly" in s)
    sys.stderr.write(f"deals: sale={n_sale} jeonse={n_jeonse} wolse={n_wolse}\n")
    sys.stderr.write(
        f"→ {len(out)} complexes, {bands} size-bands "
        f"(sale={with_sale}, jeonse={with_jeo}, wolse={with_wol})\n")
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    args = []
    for a in sys.argv[1:]:
        args += glob.glob(a)
    if not args:
        sys.exit("usage: parse_molit.py data/raw/*.xlsx > data/complexes.json")
    main(args)

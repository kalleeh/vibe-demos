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

            slot = cx["sizes"].setdefault(band, {
                "pyeong": round(pg, 1),
                "area_m2": round(float(get(row, idx, "전용면적(㎡)")), 2),
                "n": 0,
            })
            slot["n"] += 1

            if is_rent:
                kind = get(row, idx, "전월세구분")
                deposit = eok(get(row, idx, "보증금(만원)"))
                monthly = get(row, idx, "월세금(만원)").replace(",", "").strip()
                is_jeonse = (monthly in ("", "0", "-")) or kind == "전세"
                if is_jeonse and deposit is not None:
                    n_jeonse += 1
                    if ym > slot.get("jeonse_ym", ""):
                        slot["jeonse"] = round(deposit, 2)
                        slot["jeonse_ym"] = ym
                else:
                    n_wolse += 1
            else:
                price = eok(get(row, idx, "거래금액(만원)"))
                if price is not None:
                    n_sale += 1
                    if ym > slot.get("sale_ym", ""):
                        slot["sale"] = round(price, 2)
                        slot["sale_ym"] = ym

    out = list(complexes.values())
    # drop size bands that ended up with neither a sale nor jeonse price
    for c in out:
        c["sizes"] = {b: s for b, s in c["sizes"].items()
                      if "sale" in s or "jeonse" in s}
    out = [c for c in out if c["sizes"]]

    bands = sum(len(c["sizes"]) for c in out)
    with_sale = sum(1 for c in out for s in c["sizes"].values() if "sale" in s)
    with_jeo  = sum(1 for c in out for s in c["sizes"].values() if "jeonse" in s)
    sys.stderr.write(f"deals: sale={n_sale} jeonse={n_jeonse} wolse={n_wolse}\n")
    sys.stderr.write(
        f"→ {len(out)} complexes, {bands} size-bands "
        f"(bands w/ sale={with_sale}, w/ jeonse={with_jeo})\n")
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    args = []
    for a in sys.argv[1:]:
        args += glob.glob(a)
    if not args:
        sys.exit("usage: parse_molit.py data/raw/*.xlsx > data/complexes.json")
    main(args)

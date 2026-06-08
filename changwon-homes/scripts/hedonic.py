#!/usr/bin/env python3
"""
hedonic.py — test which price factors are statistically significant in OUR
Changwon sale transactions, before trusting any of them in the value model.

Pure stdlib (no numpy/statsmodels on this box): OLS via normal equations with
Gaussian elimination; heteroskedasticity-agnostic t-stats from (X'X)^-1 σ².

Model:  log(평단가_만원_per_평) ~
          floor_low(1층/저층) + floor_royal(mid-upper) + floor_top
        + age + age²
        + log(size_pyeong)
        + brand(1군 brand in 단지명)
        + months_ago (recency)
        + dist_core_km (min dist to 용지호수공원 / 의창 신도시 core)
        + 구 fixed effects (성산 as base)

Reads raw 매매 xlsx directly (transaction-level, keeps 층 which the aggregate
drops). Geocoding pulled from data/geocache.json by 도로명 key.

Usage: python3 hedonic.py > /tmp/hedonic.txt
"""
import sys, os, re, html, zipfile, glob, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
RAW  = os.path.join(HERE, "..", "data", "raw")
CACHE= os.path.join(HERE, "..", "data", "geocache.json")

CORE = [(35.232079, 128.681025),  # 용지호수공원 (성산 신도시)
        (35.256943, 128.626998)]  # 중동 유니시티 (의창 신도시)
BRANDS = ["자이","래미안","푸르지오","아이파크","더샵","힐스테이트","이편한세상",
          "e편한세상","롯데캐슬","sk뷰","SK뷰","위브","센트럴","데시앙","꿈에그린",
          "한라비발디","코오롱하늘채","유니시티","베르디움","어울림","스위첸"]

def cells(rx):
    o=[]
    for c in re.findall(r"<c[^>]*>(.*?)</c>", rx, re.S):
        m=re.search(r"<t[^>]*>(.*?)</t>", c, re.S) or re.search(r"<v>(.*?)</v>", c, re.S)
        o.append(html.unescape(m.group(1)) if m else "")
    return o
def rows(p):
    x=zipfile.ZipFile(p).read("xl/worksheets/sheet1.xml").decode("utf-8","replace")
    return [cells(r) for r in re.findall(r"<row[^>]*>(.*?)</row>", x, re.S)]

def distcore(lat,lng):
    best=9e9
    for cy,cx in CORE:
        d=math.hypot((lat-cy)*111,(lng-cx)*89)
        best=min(best,d)
    return best

def read_all():
    """First pass: collect rows + per-complex max floor (height proxy)."""
    cache=json.load(open(CACHE,encoding="utf-8"))
    GU=["성산구","의창구","마산회원구","마산합포구","진해구"]
    recs=[]; maxf={}
    for f in glob.glob(os.path.join(RAW,"molit_*.xlsx")):
        if "jeonse" in f: continue
        rs=rows(f); hi=next((i for i,v in enumerate(rs) if v and v[0]=="NO"),None)
        if hi is None: continue
        H={h:i for i,h in enumerate(rs[hi])}
        for v in rs[hi+1:]:
            if not v or not v[0] or not re.match(r"^\d",v[0]): continue
            def g(k):
                i=H.get(k); return v[i] if i is not None and i<len(v) else ""
            try:
                area=float(g("전용면적(㎡)")); py=area/3.305785
                price=int(g("거래금액(만원)").replace(",",""))
                floor=int(g("층")); built=int(g("건축년도"))
            except (ValueError, TypeError):
                continue
            if py<=0 or price<=0: continue
            parts=g("시군구").split()
            gu=next((p for p in parts if p.endswith("구")),"")
            if gu not in GU: continue
            name=g("단지명"); dong=parts[-1] if parts else ""
            coord=cache.get(f"경상남도 창원시 {gu} {dong} {g('도로명')}")
            ym=g("계약년월")
            recs.append(dict(py=py,price=price,floor=floor,built=built,gu=gu,
                             name=name,coord=coord,ym=ym))
            maxf[name]=max(maxf.get(name,0),floor)
    return recs,maxf,GU

def load():
    recs,maxf,GU=read_all()
    X=[]; Y=[]
    for r in recs:
        py=r["py"]; mf=max(maxf.get(r["name"],r["floor"]),3)
        rel=r["floor"]/mf                       # relative height 0..1
        flow  = 1 if r["floor"]<=2 else 0       # 저층 penalty
        ftop  = 1 if rel>=0.92 and mf>=5 else 0 # 탑층
        froyal= 1 if 0.5<=rel<0.92 else 0       # 로열층 (upper-mid)
        dc = distcore(*r["coord"]) if r["coord"] else 3.0
        try: months=(2026-int(r["ym"][:4]))*12+(6-int(r["ym"][4:6]))
        except: months=6
        brand=1 if any(b.lower() in r["name"].lower() for b in BRANDS) else 0
        ppp=r["price"]/py
        feats={
          "const":1.0,"flow":flow,"froyal":froyal,"ftop":ftop,
          "age":(2026-r["built"]),"age2":(2026-r["built"])**2/100.0,
          "lsize":math.log(py),"brand":brand,"months":months,"dcore":dc,
        }
        for gg in GU[1:]: feats["gu_"+gg]= 1.0 if r["gu"]==gg else 0.0
        X.append(feats); Y.append(math.log(ppp))
    return X,Y

def ols(X,Y):
    cols=list(X[0].keys()); n=len(X); k=len(cols)
    # X'X and X'Y
    XtX=[[0.0]*k for _ in range(k)]; XtY=[0.0]*k
    for r in range(n):
        xr=[X[r][c] for c in cols]; y=Y[r]
        for i in range(k):
            XtY[i]+=xr[i]*y
            for j in range(k): XtX[i][j]+=xr[i]*xr[j]
    # invert XtX via Gauss-Jordan
    A=[row[:]+[1.0 if i==j else 0.0 for j in range(k)] for i,row in enumerate(XtX)]
    for i in range(k):
        p=A[i][i]
        if abs(p)<1e-12:
            for r2 in range(i+1,k):
                if abs(A[r2][i])>1e-12: A[i],A[r2]=A[r2],A[i]; p=A[i][i]; break
        for j in range(2*k): A[i][j]/=p
        for r2 in range(k):
            if r2!=i:
                f=A[r2][i]
                for j in range(2*k): A[r2][j]-=f*A[i][j]
    inv=[row[k:] for row in A]
    beta=[sum(inv[i][j]*XtY[j] for j in range(k)) for i in range(k)]
    # residual variance
    sse=0.0
    for r in range(n):
        xr=[X[r][c] for c in cols]; pred=sum(beta[i]*xr[i] for i in range(k))
        sse+=(Y[r]-pred)**2
    sigma2=sse/(n-k)
    se=[math.sqrt(max(0,sigma2*inv[i][i])) for i in range(k)]
    # R²
    ybar=sum(Y)/n; sst=sum((y-ybar)**2 for y in Y)
    r2=1-sse/sst
    return cols,beta,se,r2,n

if __name__=="__main__":
    X,Y=load()
    cols,beta,se,r2,n=ols(X,Y)
    print(f"OLS on {n} sale transactions · R²={r2:.3f}")
    print(f"{'factor':<14}{'coef':>10}{'std.err':>10}{'t':>8}  sig")
    for c,b,s in zip(cols,beta,se):
        t=b/s if s>0 else 0
        sig="***" if abs(t)>2.58 else "**" if abs(t)>1.96 else "*" if abs(t)>1.64 else ""
        print(f"{c:<14}{b:>10.4f}{s:>10.4f}{t:>8.1f}  {sig}")
    print("\nInterpretation: DV is log(만원/평). A coef of 0.05 ≈ +5% 평단가.")

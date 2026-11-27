"""Thử Geoapify cho một điểm đến: xem `search_places` lấy được trường gì, quán TikTok có trong
Geoapify không, và Routing cho `get_travel_time`.

Script thử (spike), chạy tay. Không phải code của công cụ thật.
Dữ liệu Geoapify lấy từ OpenStreetMap (ODbL): hiển thị phải ghi "© OpenStreetMap contributors"
và "Powered by Geoapify" (gói miễn phí). Điều khoản Geoapify chưa nói gì về lưu/cache kết quả,
nên kết quả ghi vào data/raw/ (git bỏ qua), không commit.

Gọi (giá theo trang docs, ngày xem 27/11/2026; gói miễn phí 3.000 credit/ngày, 5 request/giây):
  1. Geocoding  GET /v1/geocode/search    -> place_id của thành phố (1 credit)
  2. Places     GET /v2/places            -> địa điểm theo loại trong ranh giới thành phố
                                              (theo docs: 1 credit / 20 nơi)
  3. Details    GET /v2/place-details     -> giờ mở cửa, website... (1 credit / nơi)
  4. Khớp quán TikTok, 3 cách (lần chạy 27/11: Places name=... trả rỗng cả 11 câu, kể cả
     "Bánh căn" dù danh mục có 10 quán bánh căn; docs không nói name= khớp kiểu gì):
       a. so tên trên danh mục đã tải (bỏ dấu, không phân biệt hoa thường) -> 0 credit
       b. Places name=<tên> (giữ để xem name= có chạy không, có câu đối chứng)
       c. Geocoding text=<tên>, <thành phố> (ra cả amenity) -> 1 credit / câu
  5. Routing    GET /v1/routing mode=scooter -> thời gian đi giữa vài điểm (1 credit / chặng)

Chạy:
  python scripts/spike_geoapify.py --env-file .env --city "Đà Lạt" \
      --candidates data/raw/tiktok-da-lat-<stamp>.candidates.json
Chỉ dùng thư viện chuẩn. Key nằm trong URL nên script không bao giờ in URL.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMEOUT = 30
BASE = "https://api.geoapify.com"

# Nhóm loại cho lịch trình. Chỉ dùng mã loại có trong bảng categories của docs.
GROUPS = {
    "cafe": "catering.cafe",
    "food": "catering.restaurant,catering.fast_food",
    "sight": "tourism.sights,tourism.attraction,entertainment",
}
HOURS_RE = re.compile(r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}")
PRICE_RE = re.compile(r"(\d[\d.,]*\s*k?\s*-\s*\d[\d.,]*\s*k?\s*(vnd|đ|usd))|(price)", re.I)

credits = {"geocode": 0, "places": 0, "details": 0, "routing": 0}


def load_env(path: Path) -> None:
    """Nạp KEY=VALUE vào os.environ. Không in giá trị."""
    if not path.exists():
        sys.exit(f"Không thấy file env: {path}")
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def get(path: str, params: dict) -> dict:
    key = os.getenv("GEOAPIFY_API_KEY")
    if not key:
        sys.exit("Thiếu GEOAPIFY_API_KEY trong file env")
    qs = urllib.parse.urlencode({**params, "apiKey": key})
    try:
        with urllib.request.urlopen(f"{BASE}{path}?{qs}", timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Không in e.url (có key). Thân lỗi của Geoapify không chứa key.
        return {"error": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"}
    except urllib.error.URLError as e:
        return {"error": f"URLError: {e.reason}"}


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", (text or "").lower().replace("đ", "d"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()


STOP = {"quan", "ca", "phe", "cafe", "coffee", "the", "tai", "o", "kham", "pha", "on", "tiktok",
        "review", "travel", "list", "an", "ngon", "moi"}
# Chữ chung (món, khu, kiểu bài): tên chỉ gồm các chữ này thì không đem đi khớp.
GENERIC = {"banh", "can", "mon", "khu", "sinh", "vien", "foodtour", "food", "tour", "nhung", "dang",
           "thu", "vat", "cho", "dem", "pho", "bun", "lau", "nuong", "check", "in", "song", "ao"}


def clean_guess(guess: str, city: str) -> str:
    """Bỏ tên thành phố và các chữ chung ('Quán Cà Phê', 'Khám Phá') khỏi tên đoán từ TikTok."""
    # Giữ dấu tiếng Việt trong câu gửi đi (tên OSM thường có dấu); chỉ so sánh bằng norm().
    city_words = set(norm(city).split()) | {norm(city).replace(" ", "")}
    words = [w for w in re.findall(r"\w+", guess or "")
             if norm(w) not in STOP and norm(w) not in city_words]
    return " ".join(words)


def is_distinctive(q: str) -> bool:
    """Có ít nhất một chữ riêng (không phải chữ chung, dài >= 3, không phải 'aaaa')."""
    return any(w not in GENERIC and len(w) >= 3 and len(set(w)) > 1 for w in norm(q).split())


def name_score(a: str, b: str) -> float:
    """Tỉ lệ chữ của a có trong b; viết liền ('Langfarm' = 'Lang Farm') cũng tính."""
    ta, tb = norm(a).split(), set(norm(b).split())
    if not ta:
        return 0.0
    ca, cb = "".join(ta), "".join(norm(b).split())
    if len(ca) >= 6 and ca in cb:
        return 1.0
    return sum(w in tb for w in ta) / len(ta)


def slim(feature: dict) -> dict:
    """Đổi một feature Geoapify sang dạng công cụ sẽ trả cho Roa."""
    p = feature.get("properties", {})
    raw = (p.get("datasource") or {}).get("raw") or {}
    desc = p.get("description") or ""
    return {
        "place_id": p.get("place_id"),
        "osm": f"{raw.get('osm_type')}{raw.get('osm_id')}" if raw.get("osm_id") else None,
        # OSM có nơi đặt tên là số (vd "93"); Geoapify trả về kiểu int.
        "name": str(p["name"]) if p.get("name") is not None else None,
        "categories": [c for c in p.get("categories", []) if c.count(".") >= 1][:4],
        "lat": p.get("lat"),
        "lon": p.get("lon"),
        "address": p.get("formatted"),
        "opening_hours": p.get("opening_hours"),
        "website": p.get("website"),
        "cuisine": (p.get("catering") or {}).get("cuisine"),
        "description": desc[:120] or None,
        "price_hint": bool(PRICE_RE.search(desc)),
        # Dấu hiệu đóng cửa trong tag OSM (vd tên phụ ghi "không còn hoạt động", disused:*).
        "maybe_closed": any(k.startswith(("disused:", "was:", "abandoned:")) for k in raw)
        or "не работает" in json.dumps(raw, ensure_ascii=False).lower(),
    }


def coverage(rows: list[dict]) -> dict:
    n = len(rows)

    def c(pred) -> str:
        k = sum(1 for r in rows if pred(r))
        return f"{k}/{n}"

    return {
        "name": c(lambda r: r["name"]),
        "opening_hours": c(lambda r: r["opening_hours"]),
        "hours_parseable": c(lambda r: r["opening_hours"] and HOURS_RE.search(r["opening_hours"])),
        "website": c(lambda r: r["website"]),
        "price_hint": c(lambda r: r["price_hint"]),
        "maybe_closed": c(lambda r: r["maybe_closed"]),
    }


def haversine_km(a: dict, b: dict) -> float:
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env-file", required=True, type=Path)
    ap.add_argument("--city", default="Đà Lạt")
    ap.add_argument("--limit", type=int, default=500, help="số nơi mỗi trang (tối đa 500)")
    ap.add_argument("--max-pages", type=int, default=4, help="số trang tối đa mỗi nhóm loại")
    ap.add_argument("--details", type=int, default=5, help="số nơi mỗi nhóm gọi Place Details")
    ap.add_argument("--candidates", type=Path, help="file .candidates.json từ spike_tiktok_trending.py")
    ap.add_argument("--match", type=int, default=15)
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw")
    args = ap.parse_args()
    load_env(args.env_file)
    args.out.mkdir(parents=True, exist_ok=True)
    result: dict = {"city": args.city, "groups": {}, "details": [], "matches": [], "routing": None}

    # 1) điểm đến -> place_id thành phố
    geo = get("/v1/geocode/search", {"text": args.city, "type": "city", "filter": "countrycode:vn",
                                     "lang": "vi", "limit": 1, "format": "json"})
    credits["geocode"] += 1
    if "error" in geo or not geo.get("results"):
        sys.exit(f"Geocoding không ra thành phố: {geo.get('error') or 'không có kết quả'}")
    city = geo["results"][0]
    city_id = city["place_id"]
    result["geocode"] = {k: city.get(k) for k in ("name", "state", "lat", "lon", "result_type", "rank")}
    print(f"Điểm đến: {city.get('name')} · {city.get('state')} · {city.get('result_type')} "
          f"· confidence {(city.get('rank') or {}).get('confidence')}")

    # 2) search_places theo nhóm loại, trong ranh giới thành phố, gần trung tâm trước, lấy hết trang
    all_rows: list[dict] = []
    for grp, cats in GROUPS.items():
        rows, err, pages = [], None, 0
        while pages < args.max_pages:
            data = get("/v2/places", {"categories": cats, "filter": f"place:{city_id}",
                                      "bias": f"proximity:{city['lon']},{city['lat']}",
                                      "limit": args.limit, "offset": pages * args.limit, "lang": "vi"})
            pages += 1
            if "error" in data:
                err = data["error"]
                break
            page = [slim(f) for f in data.get("features", [])]
            credits["places"] += max(1, math.ceil(len(page) / 20))
            rows += page
            if len(page) < args.limit:
                break
        if err and not rows:
            print(f"[{grp}] lỗi: {err}")
            result["groups"][grp] = {"error": err}
            continue
        full = "đủ" if len(rows) % args.limit or not rows else f"có thể còn (dừng ở {args.max_pages} trang)"
        result["groups"][grp] = {"categories": cats, "places": rows, "pages": pages, "error": err}
        all_rows += rows
        print(f"[{grp}] {len(rows)} nơi ({pages} trang, {full}) · {coverage(rows)}")
        print("    vd:", ", ".join(r["name"] for r in rows if r["name"])[:200])

    # 3) Place Details: Details có thêm giờ mở cửa không?
    for grp, g in result["groups"].items():
        for r in [r for r in g.get("places", []) if r["name"]][: args.details]:
            d = get("/v2/place-details", {"id": r["place_id"], "features": "details", "lang": "vi"})
            credits["details"] += 1
            props = ((d.get("features") or [{}])[0]).get("properties", {}) if "error" not in d else {}
            result["details"].append({"group": grp, "name": r["name"], "error": d.get("error"),
                                      "opening_hours": props.get("opening_hours"),
                                      "website": props.get("website"),
                                      "has_contact": bool(props.get("contact")),
                                      "wiki": bool(props.get("wiki_and_media"))})
    if result["details"]:
        n = len(result["details"])
        h = sum(1 for d in result["details"] if d["opening_hours"])
        print(f"\nPlace Details: {h}/{n} nơi có giờ mở cửa")

    # 4) quán TikTok có trong Geoapify không: (a) danh mục đã tải, (b) Places name=, (c) Geocoding
    if args.candidates:
        cands = json.loads(args.candidates.read_text(encoding="utf-8"))
        named = [r for r in all_rows if r["name"]]

        def places_by_name(q: str) -> list[dict]:
            data = get("/v2/places", {"categories": "catering,tourism,entertainment,accommodation",
                                      "filter": f"place:{city_id}", "name": q, "limit": 3, "lang": "vi"})
            credits["places"] += 1
            return [slim(f) for f in data.get("features", [])] if "error" not in data else []

        # Câu đối chứng: name= với một tên chắc chắn có trong danh mục.
        if named:
            probe = named[0]["name"]
            hits = places_by_name(probe)
            result["name_param_probe"] = {"name": probe, "hits": len(hits)}
            print(f"\nĐối chứng name=: tên có sẵn '{probe}' -> {len(hits)} kết quả"
                  + ("" if hits else " (name= không chạy như mong đợi)"))

        tried = skipped = 0
        for c in cands:
            guess = (c.get("_review") or {}).get("name_guess")
            q = clean_guess(guess or "", args.city)
            if not q:
                continue
            if not is_distinctive(q):
                skipped += 1
                result["matches"].append({"name_guess": guess, "query": q, "skipped": "tên chung"})
                continue
            if tried >= args.match:
                continue
            tried += 1
            m = {"name_guess": guess, "query": q, "source_url": c.get("source_url"), "via": None,
                 "score": 0.0, "geoapify": None}
            # (a) danh mục đã tải
            best = max(named, key=lambda r: name_score(q, r["name"]), default=None)
            if best and name_score(q, best["name"]) >= 0.6:
                m |= {"via": "catalog", "score": round(name_score(q, best["name"]), 2), "geoapify": best}
            # (b) Places name=
            if not m["via"]:
                tops = places_by_name(q)
                best = max(tops, key=lambda r: name_score(q, r["name"] or ""), default=None)
                if best and name_score(q, best["name"] or "") >= 0.6:
                    m |= {"via": "name=", "score": round(name_score(q, best["name"] or ""), 2), "geoapify": best}
            # (c) Geocoding theo chữ, gần thành phố
            if not m["via"]:
                geo2 = get("/v1/geocode/search", {"text": f"{q}, {args.city}", "filter": "countrycode:vn",
                                                  "bias": f"proximity:{city['lon']},{city['lat']}",
                                                  "lang": "vi", "limit": 3, "format": "json"})
                credits["geocode"] += 1
                for r in geo2.get("results", []) if "error" not in geo2 else []:
                    nm = str(r.get("name") or r.get("address_line1") or "")
                    km = haversine_km(city, r) if r.get("lat") else 999
                    if name_score(q, nm) >= 0.6 and km <= 30:
                        m |= {"via": "geocode", "score": round(name_score(q, nm), 2),
                              "geoapify": {"place_id": r.get("place_id"), "name": nm,
                                           "result_type": r.get("result_type"), "lat": r.get("lat"),
                                           "lon": r.get("lon"), "km_from_center": round(km, 1)}}
                        break
            m["accepted"] = bool(m["via"])
            result["matches"].append(m)
        ok = [m for m in result["matches"] if m.get("accepted")]
        print(f"\nKhớp TikTok -> Geoapify: thử {tried}, nhận {len(ok)}, bỏ qua {skipped} tên chung")
        for m in result["matches"]:
            if m.get("skipped"):
                print(f"  bỏ  {m['query'][:32]:32} ({m['skipped']})")
                continue
            g = m["geoapify"] or {}
            print(f"  {'OK ' if m['accepted'] else '-- '} {m['query'][:32]:32} -> "
                  f"{(g.get('name') or '(không thấy)')[:34]:34} {m['via'] or ''}")

    # 5) get_travel_time: 3 điểm tham quan đầu, xe máy (scooter)
    sights = [r for r in (result["groups"].get("sight") or {}).get("places", []) if r["name"]][:3]
    if len(sights) >= 2:
        wps = "|".join(f"{r['lat']},{r['lon']}" for r in sights)
        rt = get("/v1/routing", {"waypoints": wps, "mode": "scooter", "format": "json"})
        credits["routing"] += len(sights) - 1
        legs = ((rt.get("results") or [{}])[0]).get("legs", []) if "error" not in rt else []
        result["routing"] = {"stops": [r["name"] for r in sights], "error": rt.get("error"),
                             "legs": [{"distance_m": l.get("distance"), "time_s": l.get("time")} for l in legs]}
        print("\nRouting (scooter):")
        for i, l in enumerate(legs):
            a, b = sights[i], sights[i + 1]
            print(f"  {a['name'][:25]} -> {b['name'][:25]}: {l.get('distance', 0) / 1000:.1f} km, "
                  f"{l.get('time', 0) / 60:.0f} phút (đường chim bay {haversine_km(a, b):.1f} km)")
        if rt.get("error"):
            print("  lỗi:", rt["error"])

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = re.sub(r"\s+", "-", norm(args.city))
    path = args.out / f"geoapify-{slug}-{stamp}.json"
    result["credits_estimate"] = credits
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCredit ước tính theo docs: {credits} = {sum(credits.values())} (gói miễn phí 3.000/ngày)")
    print(f"Ghi: {path.relative_to(ROOT)} (data/raw/, không commit)")


if __name__ == "__main__":
    main()

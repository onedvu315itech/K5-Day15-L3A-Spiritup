"""Thử Google Places API (New) cho một điểm đến: xem `search_places` lấy được trường gì,
và thử khớp quán hot TikTok (file .candidates.json) sang `place_id`.

Script thử (spike), chạy tay. Không phải code của công cụ thật.
Điều khoản Google: chỉ `place_id` được lưu lâu dài; toạ độ cache tối đa 30 ngày; tên, địa chỉ,
giờ mở cửa, đánh giá không được chép lưu. Vì vậy kết quả ghi vào data/raw/ (git bỏ qua), không commit.

Gọi:
  - Text Search (New): POST https://places.googleapis.com/v1/places:searchText
    Field mask có giờ mở cửa, mức giá, đánh giá => SKU Text Search Enterprise (1.000 lượt miễn phí/tháng).
Mỗi lần chạy mặc định: 3 câu tìm theo loại + tối đa --match N câu khớp quán TikTok.

Chạy:
  python scripts/spike_google_places.py --env-file .env --city "Đà Lạt" \
      --candidates data/raw/tiktok-da-lat-<stamp>.candidates.json --match 15
Chỉ dùng thư viện chuẩn của Python. Không in key.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMEOUT = 30
SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

# Trường cần cho lịch trình. Có regularOpeningHours/priceLevel/rating => SKU Enterprise.
FIELDS = [
    "id", "displayName", "formattedAddress", "location", "types", "primaryType",
    "businessStatus", "regularOpeningHours", "priceLevel", "priceRange",
    "rating", "userRatingCount", "googleMapsUri",
]
FIELD_MASK = ",".join(f"places.{f}" for f in FIELDS)

CATEGORY_QUERIES = {
    "cafe": "quán cà phê ở {city}",
    "food": "quán ăn ngon ở {city}",
    "sight": "địa điểm tham quan ở {city}",
}


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


def text_search(query: str, page_size: int) -> dict:
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        sys.exit("Thiếu GOOGLE_MAPS_API_KEY trong file env")
    body = {"textQuery": query, "languageCode": "vi", "regionCode": "VN", "pageSize": page_size}
    req = urllib.request.Request(SEARCH_URL, data=json.dumps(body).encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Goog-Api-Key", key)
    req.add_header("X-Goog-FieldMask", FIELD_MASK)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Thông báo lỗi của Google không chứa key.
        return {"error": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:400]}"}
    except urllib.error.URLError as e:
        return {"error": f"URLError: {e.reason}"}


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower().replace("đ", "d"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()


STOP = {"da", "lat", "dalat", "quan", "cafe", "coffee", "ca", "phe", "the", "tai", "o"}


def name_score(a: str, b: str) -> float:
    """Tỉ lệ từ có nghĩa của a xuất hiện trong b (bỏ tên thành phố, 'quán', 'cafe')."""
    ta = [w for w in norm(a).split() if w not in STOP]
    tb = set(norm(b).split())
    if not ta:
        return 0.0
    return sum(w in tb for w in ta) / len(ta)


def slim(place: dict) -> dict:
    """Đổi một place của Google sang dạng công cụ sẽ trả cho Roa."""
    hours = place.get("regularOpeningHours") or {}
    pr = place.get("priceRange") or {}

    def money(m):
        return int(m["units"]) if m and "units" in m else None

    return {
        "place_id": place.get("id"),
        "name": (place.get("displayName") or {}).get("text"),
        "address": place.get("formattedAddress"),
        "lat": (place.get("location") or {}).get("latitude"),
        "lng": (place.get("location") or {}).get("longitude"),
        "primary_type": place.get("primaryType"),
        "types": place.get("types", [])[:5],
        "business_status": place.get("businessStatus"),
        "opening_periods": hours.get("periods"),  # open/close {day 0=CN, hour, minute}
        "opening_text": hours.get("weekdayDescriptions"),
        "price_level": place.get("priceLevel"),
        "price_range_vnd": [money(pr.get("startPrice")), money(pr.get("endPrice"))] if pr else None,
        "rating": place.get("rating"),
        "user_rating_count": place.get("userRatingCount"),
    }


def coverage(rows: list[dict]) -> dict:
    n = len(rows) or 1
    keys = ["lat", "opening_periods", "price_level", "price_range_vnd", "rating"]
    return {k: f"{sum(1 for r in rows if r.get(k))}/{len(rows)}" for k in keys} | {"_pct_hours": round(100 * sum(1 for r in rows if r.get("opening_periods")) / n)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env-file", required=True, type=Path)
    ap.add_argument("--city", default="Đà Lạt")
    ap.add_argument("--page-size", type=int, default=10)
    ap.add_argument("--candidates", type=Path, help="file .candidates.json từ spike_tiktok_trending.py")
    ap.add_argument("--match", type=int, default=15, help="số quán TikTok thử khớp place_id")
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw")
    args = ap.parse_args()
    load_env(args.env_file)
    args.out.mkdir(parents=True, exist_ok=True)

    calls = 0
    result: dict = {"city": args.city, "field_mask": FIELD_MASK, "by_category": {}, "matches": []}

    # 1) search_places theo loại
    for cat, tpl in CATEGORY_QUERIES.items():
        q = tpl.format(city=args.city)
        data = text_search(q, args.page_size)
        calls += 1
        if "error" in data:
            print(f"[{cat}] lỗi: {data['error']}")
            result["by_category"][cat] = {"query": q, "error": data["error"]}
            continue
        rows = [slim(p) for p in data.get("places", [])]
        result["by_category"][cat] = {"query": q, "places": rows}
        print(f"[{cat}] '{q}': {len(rows)} nơi · có trường: {coverage(rows)}")

    # 2) khớp quán hot TikTok sang place_id
    if args.candidates:
        cands = json.loads(args.candidates.read_text(encoding="utf-8"))
        tried = 0
        for c in cands:
            guess = (c.get("_review") or {}).get("name_guess")
            if not guess or tried >= args.match:
                continue
            tried += 1
            q = guess if norm(args.city) in norm(guess) else f"{guess} {args.city}"
            data = text_search(q, 1)
            calls += 1
            top = (data.get("places") or [None])[0]
            row = {"name_guess": guess, "source_url": c.get("source_url"), "query": q}
            if top:
                s = slim(top)
                row |= {"score": round(name_score(guess, s["name"] or ""), 2), "google": s}
            else:
                row |= {"score": 0, "google": None, "error": data.get("error")}
            row["accepted"] = row["score"] >= 0.6
            result["matches"].append(row)
        ok = [m for m in result["matches"] if m["accepted"]]
        print(f"\nKhớp TikTok -> place_id: thử {tried}, nhận {len(ok)} (điểm tên >= 0.6)")
        for m in result["matches"]:
            g = m.get("google") or {}
            mark = "OK " if m["accepted"] else "-- "
            print(f"  {mark}{m['score']:.2f}  {m['name_guess'][:40]:40} -> {(g.get('name') or '(không thấy)')[:40]}")
        if ok:
            print(f"  Quán đã khớp có giờ mở cửa: {coverage([m['google'] for m in ok])}")

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = re.sub(r"\s+", "-", norm(args.city))
    path = args.out / f"places-{slug}-{stamp}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSố lượt gọi Text Search (Enterprise): {calls}")
    print(f"Ghi: {path.relative_to(ROOT)} (data/raw/, không commit)")


if __name__ == "__main__":
    main()

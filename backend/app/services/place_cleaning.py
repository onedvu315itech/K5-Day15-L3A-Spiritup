"""Lọc và xếp ưu tiên nơi Geoapify vào kho (docs/DATABASE.md mục 5.2). Hàm thuần: không DB, không mạng.

Lấy từ scripts/spike_geoapify.py (`slim`) và scripts/build_place_store.py (`parse_hours`, ánh xạ loại), khác ở chỗ:
nơi thiếu giờ hoặc giá vẫn giữ, gắn cờ chưa xác minh (OQ-22); thêm `geo_category`, `geo_categories`, `rank`.
"""
import json
import math
import re
import unicodedata

# Nhóm loại gọi Geoapify Places. Chỉ dùng mã loại có trong bảng categories của docs Geoapify.
GROUPS = {
    "cafe": "catering.cafe",
    "food": "catering.restaurant,catering.fast_food",
    "sight": "tourism.sights,tourism.attraction,entertainment",
}
GROUP_TO_CATEGORY = {"cafe": "cafe", "food": "food", "sight": "sightseeing"}

EVERYDAY = re.compile(r"^(?:Mo-Su\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")
WARD = re.compile(r"((?:Phường|Xã|Thị trấn) [^,]+?)(?: - [^,]+)?,")
CLOSED_PREFIXES = ("disused:", "was:", "abandoned:")
HOT_MATCH_MIN = 0.6  # tỉ lệ chữ trùng để coi là cùng quán, như spike_geoapify.py


def parse_hours(text):
    """(mở, đóng) theo phút từ 0h; đóng qua nửa đêm thì cộng 24h. Chỉ đọc một khung giờ áp cho mọi ngày
    (`Mo-Su 07:00-22:00`, `07:00-22:00`, `24/7`); dạng khác trả None để không đọc sai giờ."""
    if not text:
        return None
    text = str(text).strip()
    if text == "24/7":
        return 0, 24 * 60
    m = EVERYDAY.match(text)
    if not m:
        return None
    oh, om, ch, cm = map(int, m.groups())
    open_min, close_min = oh * 60 + om, ch * 60 + cm
    if close_min <= open_min:
        close_min += 24 * 60
    if open_min >= 24 * 60 or close_min > 48 * 60:
        return None
    return open_min, close_min


def slim(feature: dict) -> dict:
    """Một feature Geoapify Places → các trường kho cần."""
    p = feature.get("properties", {}) or {}
    raw = (p.get("datasource") or {}).get("raw") or {}
    return {
        "place_id": p.get("place_id"),
        "osm": f"{raw.get('osm_type')}{raw.get('osm_id')}" if raw.get("osm_id") else None,
        # OSM có nơi đặt tên là số; Geoapify trả kiểu int.
        "name": str(p["name"]).strip() if p.get("name") is not None else None,
        "categories": [c for c in p.get("categories", []) or [] if c.count(".") >= 1],
        "lat": p.get("lat"),
        "lon": p.get("lon"),
        "address": p.get("formatted"),
        "opening_hours": p.get("opening_hours"),
        "website": p.get("website"),
        "cuisine": (p.get("catering") or {}).get("cuisine"),
        "maybe_closed": any(str(k).startswith(CLOSED_PREFIXES) for k in raw)
        or "не работает" in json.dumps(raw, ensure_ascii=False).lower(),
    }


def geo_category(codes: list) -> str | None:
    """Mã loại cụ thể nhất (nhiều dấu chấm nhất); bằng nhau thì lấy mã đứng trước."""
    best = None
    for c in codes or []:
        if best is None or c.count(".") > best.count("."):
            best = c
    return best


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", (text or "").lower().replace("đ", "d"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()


# Chữ chung trong tên quán: không dùng để khớp quán hot.
_HOT_STOP = {"quan", "ca", "phe", "cafe", "coffee", "the", "tiem", "nha", "hang"}


def name_score(a: str, b: str) -> float:
    """Tỉ lệ chữ riêng của a có trong b; viết liền ('Langfarm' = 'Lang Farm') cũng tính."""
    ta = [w for w in norm(a).split() if w not in _HOT_STOP]
    tb = set(norm(b).split())
    if not ta:
        return 0.0
    ca, cb = "".join(ta), "".join(norm(b).split())
    if len(ca) >= 6 and ca in cb:
        return 1.0
    return sum(w in tb for w in ta) / len(ta)


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (lat1, lon1, lat2, lon2))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _vegetarian(name: str, cuisine) -> bool | None:
    c = str(cuisine or "").lower()
    return True if ("vegetarian" in c or "vegan" in c or " chay" in f" {name.lower()}") else None


def select_places(groups: dict, center: tuple | None, hot_names: list, max_cafe: int, max_food: int,
                  fetched_at) -> list[dict]:
    """groups: {"cafe"|"food"|"sight": [slim(...)]}. Trả dòng `places` (chưa có city_slug) đã xếp `rank`.

    1. Bỏ nơi không tên, không mã OSM, có dấu hiệu đóng cửa; trùng mã OSM giữa các nhóm thì giữ lần đầu.
    2. Thiếu giờ hoặc giá vẫn giữ, gắn cờ chưa xác minh. Không đoán giờ, không đoán giá.
    3. Xếp trong từng category: quán hot → có giờ đọc được → có website → gần tâm thành phố.
    4. Giữ tối đa max_cafe cafe, max_food quán ăn, mọi điểm tham quan.
    """
    seen, by_cat = set(), {}
    for group, items in groups.items():
        category = GROUP_TO_CATEGORY.get(group)
        if not category:
            continue
        for p in items:
            name, osm = p.get("name"), p.get("osm")
            if not name or not osm or p.get("maybe_closed") or osm in seen:
                continue
            seen.add(osm)
            hours = parse_hours(p.get("opening_hours"))
            ward = WARD.search(p.get("address") or "")
            dist = (haversine_km(center[0], center[1], p["lat"], p["lon"])
                    if center and p.get("lat") is not None and p.get("lon") is not None else math.inf)
            codes = list(p.get("categories") or [])
            by_cat.setdefault(category, []).append({
                "ref": f"osm:{osm}",
                "name": name,
                "category": category,
                "geo_category": geo_category(codes),
                "geo_categories": codes,
                "area": ward.group(1) if ward else None,
                "address": p.get("address"),
                "lat": p.get("lat"),
                "lon": p.get("lon"),
                "open_min": hours[0] if hours else None,
                "close_min": hours[1] if hours else None,
                "opening_hours_raw": p.get("opening_hours"),
                "hours_unverified": hours is None,
                "avg_price_vnd": None,
                "price_unverified": True,
                "vegetarian_friendly": _vegetarian(name, p.get("cuisine")),
                "is_hot": any(name_score(h, name) >= HOT_MATCH_MIN for h in hot_names),
                "website": p.get("website"),
                "source": "osm_geoapify",
                "source_url": f"https://www.openstreetmap.org/{_osm_path(osm)}" if _osm_path(osm) else None,
                "fetched_at": fetched_at,
                "_dist": dist,
            })
    caps = {"cafe": max_cafe, "food": max_food}
    out = []
    for category in sorted(by_cat):
        rows = sorted(by_cat[category], key=lambda r: (not r["is_hot"], r["hours_unverified"], not r["website"],
                                                       r["_dist"], r["name"]))
        if category in caps:
            rows = rows[:caps[category]]
        for i, r in enumerate(rows, 1):
            r.pop("_dist")
            r["rank"] = i
            out.append(r)
    return out


def _osm_path(osm: str) -> str | None:
    m = re.match(r"^(node|way|relation)(\d+)$", osm or "")
    return f"{m.group(1)}/{m.group(2)}" if m else None

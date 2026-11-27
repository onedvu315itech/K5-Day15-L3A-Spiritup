"""Tìm quán ăn, cafe, điểm chơi, khách sạn từ OpenStreetMap (Overpass + fallback Nominatim BBox).

Chỉ dùng thư viện chuẩn của Python 3.10+ để chạy trực tiếp trong `codebase/` và `backend/`.
Tuân thủ R-36: địa điểm thiếu `opening_hours` hoặc `address` trên OSM trả về `None` ("chưa rõ"),
tuyệt đối không tự bịa giờ mở cửa.
"""

from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from typing import Any

USER_AGENT = "Partaway-Roa/0.1 (AI20K-Hackathon-Spiritup)"

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"

# Ánh xạ giữa loại địa điểm và `kind` trong docs/DATABASE.md §3.1
CATEGORY_ALIASES: dict[str, str] = {
    "restaurant": "restaurant",
    "food": "restaurant",
    "cafe": "cafe",
    "attraction": "attraction",
    "sight": "attraction",
    "hotel": "hotel",
}

CATEGORY_TO_KIND: dict[str, str] = {
    "restaurant": "food",
    "cafe": "cafe",
    "attraction": "sight",
    "hotel": "hotel",
}

_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_CACHE_TTL_SECONDS = 3600.0
_LAST_NOMINATIM_TS = 0.0


def make_bbox_around(lat: float, lng: float, radius_km: float = 2.5) -> tuple[float, float, float, float]:
    """Tính khung giới hạn `(south, west, north, east)` quanh tâm `(lat, lng)` theo bán kính `radius_km`."""
    dlat = radius_km / 111.0
    dlng = radius_km / max(111.0 * math.cos(math.radians(lat)), 1e-6)
    return (lat - dlat, lng - dlng, lat + dlat, lng + dlng)


def clear_places_cache() -> None:
    """Xoá bộ nhớ đệm tìm địa điểm trong tiến trình hiện tại."""
    _CACHE.clear()


def _normalize_categories(categories: list[str] | None) -> list[str]:
    if not categories:
        return ["restaurant", "cafe", "attraction", "hotel"]
    normalized: list[str] = []
    for raw in categories:
        key = raw.strip().lower()
        if key in ("all", "*"):
            return ["restaurant", "cafe", "attraction", "hotel"]
        mapped = CATEGORY_ALIASES.get(key)
        if mapped and mapped not in normalized:
            normalized.append(mapped)
    return normalized or ["restaurant", "cafe", "attraction", "hotel"]


def _build_overpass_query(
    bbox: tuple[float, float, float, float],
    categories: list[str],
    timeout_sec: int,
    max_raw: int,
) -> str:
    south, west, north, east = bbox
    box_str = f"{south:.5f},{west:.5f},{north:.5f},{east:.5f}"
    clauses: list[str] = []
    if "restaurant" in categories:
        clauses.append(f'nwr["amenity"="restaurant"]({box_str});')
    if "cafe" in categories:
        clauses.append(f'nwr["amenity"="cafe"]({box_str});')
    if "attraction" in categories:
        clauses.append(f'nwr["tourism"="attraction"]({box_str});')
        clauses.append(f'nwr["tourism"="viewpoint"]({box_str});')
        clauses.append(f'nwr["tourism"="museum"]({box_str});')
    if "hotel" in categories:
        clauses.append(f'nwr["tourism"="hotel"]({box_str});')
        clauses.append(f'nwr["tourism"="guest_house"]({box_str});')
    return f"[out:json][timeout:{timeout_sec}];({''.join(clauses)});out center tags {max_raw};"


def _parse_overpass_elements(elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    places: list[dict[str, Any]] = []
    for el in elements:
        tags = el.get("tags") or {}
        name = (tags.get("name:vi") or tags.get("name") or "").strip()
        if not name:
            continue

        lat_val = el.get("lat")
        lng_val = el.get("lon")
        if lat_val is None or lng_val is None:
            center = el.get("center") or {}
            lat_val = center.get("lat")
            lng_val = center.get("lon")
        if lat_val is None or lng_val is None:
            continue

        amenity = tags.get("amenity")
        tourism = tags.get("tourism")
        if amenity == "restaurant":
            category = "restaurant"
        elif amenity == "cafe":
            category = "cafe"
        elif tourism in ("hotel", "guest_house"):
            category = "hotel"
        else:
            category = "attraction"

        addr_parts = [
            tags.get("addr:housenumber"),
            tags.get("addr:street"),
            tags.get("addr:subdistrict") or tags.get("addr:quarter"),
            tags.get("addr:city"),
        ]
        address = tags.get("addr:full") or ", ".join(p.strip() for p in addr_parts if p and p.strip()) or None
        opening_hours = (tags.get("opening_hours") or "").strip() or None
        phone = (tags.get("phone") or tags.get("contact:phone") or "").strip() or None
        website = (tags.get("website") or tags.get("contact:website") or "").strip() or None

        osm_type = el.get("type", "node")
        osm_id = el.get("id", "")
        place_id = f"osm:{osm_type}:{osm_id}"

        lat_f = float(lat_val)
        lng_f = float(lng_val)
        places.append(
            {
                "place_id": place_id,
                "name": name,
                "kind": CATEGORY_TO_KIND[category],
                "category": category,
                "lat": lat_f,
                "lng": lng_f,
                "lon": lng_f,
                "address": address,
                "opening_hours": opening_hours,
                "phone": phone,
                "website": website,
                "sources": [{"type": "osm", "ref": place_id}],
            }
        )
    return places


def _fetch_from_overpass(
    bbox: tuple[float, float, float, float],
    categories: list[str],
    timeout: float,
    max_raw: int,
) -> list[dict[str, Any]]:
    query = _build_overpass_query(bbox, categories, timeout_sec=max(int(timeout), 3), max_raw=max_raw)
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    last_err: Exception | None = None

    for endpoint in OVERPASS_ENDPOINTS:
        req = urllib.request.Request(
            endpoint,
            data=encoded,
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return _parse_overpass_elements(payload.get("elements") or [])
        except Exception as exc:
            last_err = exc
            continue

    if last_err is not None:
        raise last_err
    return []


def _fetch_from_nominatim_bbox(
    bbox: tuple[float, float, float, float],
    categories: list[str],
    keyword: str | None,
    per_cat_limit: int,
    timeout: float,
) -> list[dict[str, Any]]:
    """Fallback nhanh khi Overpass 502/timeout: dùng Nominatim khoá cứng `viewbox` + `bounded=1`."""
    global _LAST_NOMINATIM_TS
    south, west, north, east = bbox
    # Nominatim viewbox theo thứ tự: left(west), top(north), right(east), bottom(south)
    viewbox = f"{west:.5f},{north:.5f},{east:.5f},{south:.5f}"
    places: list[dict[str, Any]] = []

    for category in categories:
        elapsed = time.monotonic() - _LAST_NOMINATIM_TS
        if elapsed < 1.05:
            time.sleep(1.05 - elapsed)

        q_str = f"{keyword} {category}".strip() if keyword else category
        params = urllib.parse.urlencode(
            {
                "q": q_str,
                "format": "jsonv2",
                "viewbox": viewbox,
                "bounded": 1,
                "extratags": 1,
                "addressdetails": 1,
                "limit": min(max(per_cat_limit, 10), 40),
            }
        )
        req = urllib.request.Request(
            f"{NOMINATIM_SEARCH_URL}?{params}",
            headers={"User-Agent": USER_AGENT, "Accept-Language": "vi,en;q=0.8"},
        )
        _LAST_NOMINATIM_TS = time.monotonic()
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            rows = json.loads(resp.read().decode("utf-8"))

        for row in rows:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            addr_obj = row.get("address") or {}
            addr_parts = [
                addr_obj.get("house_number"),
                addr_obj.get("road"),
                addr_obj.get("suburb") or addr_obj.get("quarter"),
                addr_obj.get("city") or addr_obj.get("town"),
            ]
            address = ", ".join(p.strip() for p in addr_parts if p and p.strip()) or None
            extratags = row.get("extratags") or {}
            opening_hours = (extratags.get("opening_hours") or "").strip() or None
            phone = (extratags.get("phone") or extratags.get("contact:phone") or "").strip() or None
            website = (extratags.get("website") or extratags.get("contact:website") or "").strip() or None

            osm_type = row.get("osm_type", "node")
            osm_id = row.get("osm_id", row.get("place_id", ""))
            place_id = f"osm:{osm_type}:{osm_id}"
            lat_f = float(row["lat"])
            lng_f = float(row["lon"])

            places.append(
                {
                    "place_id": place_id,
                    "name": name,
                    "kind": CATEGORY_TO_KIND[category],
                    "category": category,
                    "lat": lat_f,
                    "lng": lng_f,
                    "lon": lng_f,
                    "address": address,
                    "opening_hours": opening_hours,
                    "phone": phone,
                    "website": website,
                    "sources": [{"type": "osm", "ref": place_id}],
                }
            )
    return places


def _dedupe_and_filter(
    places: list[dict[str, Any]],
    keyword: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    kw = (keyword or "").strip().lower()
    seen: set[tuple[str, float, float]] = set()
    output: list[dict[str, Any]] = []

    for item in places:
        if kw:
            haystack = f"{item['name']} {item.get('address') or ''}".lower()
            if kw not in haystack:
                continue
        dedupe_key = (item["name"].strip().lower(), round(item["lat"], 4), round(item["lng"], 4))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        output.append(item)
        if len(output) >= limit:
            break
    return output


def search_places_osm(
    lat: float | None = None,
    lng: float | None = None,
    *,
    categories: list[str] | None = None,
    radius_km: float = 2.5,
    bbox: tuple[float, float, float, float] | None = None,
    keyword: str | None = None,
    limit: int = 50,
    timeout: float = 6.0,
    use_cache: bool = True,
) -> list[dict[str, Any]]:
    """Tìm quán ăn, cafe, điểm chơi, khách sạn trong khung bản đồ hoặc bán kính quanh `(lat, lng)`.

    Tham số:
        lat, lng: Toạ độ tâm tìm kiếm (bắt buộc nếu không truyền `bbox`).
        categories: Danh sách loại cần lấy (`restaurant`/`food`, `cafe`, `attraction`/`sight`, `hotel`).
        radius_km: Bán kính hộp tính từ `(lat, lng)` khi không truyền `bbox`.
        bbox: Bộ 4 số `(south, west, north, east)` lấy trực tiếp từ khung nhìn của map.
        keyword: Từ khoá lọc thêm theo tên hoặc địa chỉ (tuỳ chọn).
        limit: Số địa điểm tối đa trả về.
        timeout: Thời gian chờ mỗi lần gọi mạng (giây).
        use_cache: Bật cache trong bộ nhớ để tránh gọi lặp lại cùng vùng bản đồ.

    Trả về:
        Danh sách dict có đủ `place_id`, `name`, `kind`, `category`, `lat`, `lng`, `lon`,
        `address` (`None` nếu thiếu), `opening_hours` (`None` nếu thiếu, không tự bịa), `sources`.
    """
    if bbox is None:
        if lat is None or lng is None:
            raise ValueError("Cần truyền `(lat, lng)` hoặc `bbox=(south, west, north, east)`.")
        target_bbox = make_bbox_around(float(lat), float(lng), float(radius_km))
    else:
        if len(bbox) != 4:
            raise ValueError("`bbox` phải gồm 4 giá trị `(south, west, north, east)`.")
        target_bbox = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))

    norm_cats = _normalize_categories(categories)
    cache_key = json.dumps(
        {
            "bbox": [round(x, 4) for x in target_bbox],
            "cats": norm_cats,
            "kw": (keyword or "").strip().lower(),
            "limit": limit,
        },
        sort_keys=True,
    )

    now = time.monotonic()
    if use_cache and cache_key in _CACHE:
        ts, cached_items = _CACHE[cache_key]
        if now - ts <= _CACHE_TTL_SECONDS:
            return [dict(item) for item in cached_items]

    max_raw = max(limit * 4, 120)
    try:
        raw_places = _fetch_from_overpass(target_bbox, norm_cats, timeout=timeout, max_raw=max_raw)
    except Exception:
        raw_places = _fetch_from_nominatim_bbox(
            target_bbox,
            norm_cats,
            keyword=keyword,
            per_cat_limit=max(limit, 20),
            timeout=max(timeout, 6.0),
        )

    final_places = _dedupe_and_filter(raw_places, keyword=keyword, limit=limit)
    if use_cache:
        _CACHE[cache_key] = (now, final_places)
    return [dict(item) for item in final_places]

"""Công cụ của Roa — chỉ đọc, không tác động ra ngoài.

Mỗi công cụ là một hàm Python có @tool. Docstring ghi đúng 4 ý như sơ đồ ở spec.md §4:
    tên · input · output · có tác động ra ngoài không (gửi tin, sửa dữ liệu, chấm điểm…)

Dữ liệu chỉ đọc từ kho file đã thu trước, không gọi mạng lúc chạy:
  - `data/places/<slug>.json`: kho một thành phố, dựng bằng scripts/build_place_store.py (OSM qua Geoapify).
  - `data/places_vn.json`: kho sạch đa thành phố (Đà Lạt, Hà Nội, Đà Nẵng, TP.HCM, Huế); trùng mã thì
    bản ghi ở đây thắng vì có toạ độ.
  - `data/trending_spots.json`: quán hot thu trước từ TikTok (có bản ghi chưa khớp được địa điểm).
Giờ tính theo phút từ 0h (`open_min`, `close_min`; thiếu dữ liệu thì None); đóng qua nửa đêm thì > 1440.
Mọi giờ, tiền, thời gian đi do code ở đây tính, model không tự nhẩm.
"""
import json
import math
import os
import re
import unicodedata

if __package__:
    from .tracing import tool, TOOLS  # noqa: F401
else:
    from tracing import tool, TOOLS  # noqa: F401

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
STORE_DIR = os.path.join(DATA_DIR, "places")
MULTI_CITY_FILE = "places_vn.json"
TRENDING_FILE = "trending_spots.json"

CATEGORIES = ("food", "snack", "cafe", "sightseeing", "activity")
# Tên gọi khác nhau của cùng một thành phố → khoá chung (slug).
CITY_ALIASES = {"tp-hcm": "tp-hcm", "tphcm": "tp-hcm", "hcm": "tp-hcm", "ho-chi-minh": "tp-hcm",
                "thanh-pho-ho-chi-minh": "tp-hcm", "tp-ho-chi-minh": "tp-hcm", "sai-gon": "tp-hcm",
                "saigon": "tp-hcm"}

# Thời gian đi xe máy khi thiếu toạ độ (bộ mẫu CP2 chỉ có khu vực). Số nhóm tự đặt ở CP2.
AREA_MINUTES = {"Cầu Đất": 45, "Trại Mát": 25}
SAME_AREA_MIN = 10
DEFAULT_MIN = 15
# Có toạ độ: đường thật ≈ 1,7 × đường chim bay (đo trên 2 chặng Routing, docs/roa-agent-design.md 2.1),
# xe máy 25 km/h trong phố, cộng 5 phút gửi xe *(tự ước tính)*.
ROAD_FACTOR, SCOOTER_KMH, PARKING_MIN = 1.7, 25, 5
# Ngưỡng khoảng trống sau khi trừ thời gian đi (docs/features/cong-cu-lich-trinh.md BR-04).
GAP_SHORT_MAX, GAP_MEDIUM_MAX = 45, 90


def slug(text: str) -> str:
    t = unicodedata.normalize("NFD", (text or "").lower()).replace("đ", "d")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def city_key(city: str) -> str:
    key = slug(city)
    return CITY_ALIASES.get(key, key)


def _read(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _minutes(hour):
    return None if hour is None else int(round(float(hour) * 60))


_CATALOG = {}


def _catalog() -> dict:
    """Mọi địa điểm theo mã, nạp một lần. Kho một thành phố trước, kho đa thành phố đè lên khi trùng mã."""
    if _CATALOG:
        return _CATALOG
    if os.path.isdir(STORE_DIR):
        for name in sorted(os.listdir(STORE_DIR)):
            if name.endswith(".json"):
                for p in (_read(os.path.join(STORE_DIR, name)) or {}).get("places", []):
                    _CATALOG[p["id"]] = dict(p)
    for p in _read(os.path.join(DATA_DIR, MULTI_CITY_FILE)) or []:
        row = dict(p)
        row["open_min"], row["close_min"] = _minutes(p.get("open_hour")), _minutes(p.get("close_hour"))
        if row["close_min"] is not None and row["open_min"] is not None and row["close_min"] <= row["open_min"]:
            row["close_min"] += 24 * 60
        old = _CATALOG.get(row["id"], {})
        row.setdefault("address", old.get("address"))
        _CATALOG[row["id"]] = row
    return _CATALOG


def _all_places() -> dict:
    return _catalog()


def _store(city: str) -> list:
    key = city_key(city)
    if not key:
        return []
    return [p for p in _catalog().values() if city_key(p["city"]) == key]


def supported_cities() -> list:
    """Các thành phố đã có kho (tên hiển thị)."""
    seen = {}
    for p in _catalog().values():
        seen.setdefault(city_key(p["city"]), p["city"])
    return sorted(seen.values(), key=slug)


def city_name(city: str):
    """Tên hiển thị trong kho của một thành phố (gộp tên gọi khác); None nếu chưa có kho."""
    key = city_key(city)
    for c in supported_cities():
        if city_key(c) == key:
            return c
    return None


def hhmm(minutes) -> str:
    if minutes is None:
        return "?"
    minutes = int(minutes) % (24 * 60) if minutes != 24 * 60 else 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def has_hours(p: dict) -> bool:
    return p.get("open_min") is not None and p.get("close_min") is not None


def is_sample(p: dict) -> bool:
    """Giờ, giá thuộc bộ mẫu CP2 nhóm tự đặt, chưa có nguồn."""
    src = str(p.get("source") or "")
    return src == "mau_cp2" or (src.startswith("mock_cp2") and "curated" not in src)


def _public(p: dict) -> dict:
    return {
        "id": p["id"], "name": p["name"], "city": p.get("city"), "category": p["category"], "area": p.get("area"),
        "open": hhmm(p["open_min"]) if has_hours(p) else None,
        "close": hhmm(p["close_min"]) if has_hours(p) else None,
        "avg_price_vnd": p.get("avg_price_vnd"),
        "vegetarian_friendly": p.get("vegetarian_friendly"),
        "is_hot": bool(p.get("is_hot")), "source": p.get("source"),
    }


def _wanted_categories(category) -> set:
    if not category:
        return set()
    text = category if isinstance(category, str) else " ".join(category)
    return {c for c in CATEGORIES if c in text.lower()}


@tool
def search_places(city: str, preference: str = "", category: str = "") -> list:
    """Tra địa điểm trong kho theo thành phố, sở thích và loại.
    Input: city (str; "TP.HCM", "Sài Gòn", "Hồ Chí Minh" là một), preference (str, vd "chay"),
    category ("food" | "snack" | "cafe" | "sightseeing" | "activity", có thể nhiều loại cách nhau dấu phẩy; "" = mọi loại).
    Output: danh sách dict {id, name, city, category, area, open, close, avg_price_vnd, vegetarian_friendly, is_hot, source};
    open/close = None khi kho chưa có giờ; rỗng nếu thành phố chưa có kho. Không tác động ra ngoài."""
    rows = _store(city)
    cats = _wanted_categories(category)
    if cats:
        rows = [p for p in rows if p["category"] in cats]
    if "chay" in (preference or "").lower():
        rows = [p for p in rows if p.get("vegetarian_friendly")]
    return [_public(p) for p in sorted(rows, key=lambda p: p["id"])]


def _trending_records(city: str) -> list:
    key = city_key(city)
    return [r for r in _read(os.path.join(DATA_DIR, TRENDING_FILE)) or [] if city_key(r.get("city")) == key]


@tool
def get_trending_spots(city: str) -> list:
    """Lấy danh sách quán đang hot từ kho thu trước (TikTok, không crawl lúc chạy) theo thành phố.
    Input: city (str). Output: danh sách dict cùng dạng search_places, thêm source_url nếu có;
    quán TikTok chưa khớp được địa điểm trong kho có id = None và giờ, giá = None. Không tác động ra ngoài."""
    by_id = _catalog()
    out, seen = [], set()
    for r in _trending_records(city):
        pid = r.get("place_id")
        if pid in by_id:
            row = _public(by_id[pid])
        else:
            row = {"id": None, "name": r["name"], "city": r.get("city"), "category": r.get("category"), "area": None,
                   "open": None, "close": None, "avg_price_vnd": None, "vegetarian_friendly": None,
                   "is_hot": True, "source": "tiktok_chua_khop_kho"}
        row["source_url"] = r.get("source_url")
        out.append(row)
        seen.add(pid or slug(r["name"]))
    out += [_public(p) for p in sorted(_store(city), key=lambda p: p["id"]) if p.get("is_hot") and p["id"] not in seen]
    return out


@tool
def get_opening_hours(place_ids: list) -> dict:
    """Tra giờ mở cửa và đóng cửa của các địa điểm theo mã.
    Input: place_ids (list[str]). Output: dict {id: {name, open, close}}; open/close = None khi kho chưa có giờ;
    mã không có trong kho thì bỏ qua. Không tác động ra ngoài."""
    by_id = _catalog()
    out = {}
    for pid in place_ids:
        if pid in by_id:
            p = by_id[pid]
            out[pid] = {"name": p["name"], "open": hhmm(p["open_min"]) if has_hours(p) else None,
                        "close": hhmm(p["close_min"]) if has_hours(p) else None}
    return out


def _travel(a: dict, b: dict) -> int:
    if a.get("lat") is not None and b.get("lat") is not None:
        r = 6371.0
        p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
        dp, dl = p2 - p1, math.radians(b["lon"] - a["lon"])
        h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        km = 2 * r * math.asin(math.sqrt(h)) * ROAD_FACTOR
        return max(SAME_AREA_MIN, round(km / SCOOTER_KMH * 60) + PARKING_MIN)
    areas = (a.get("area"), b.get("area"))
    for name, minutes in AREA_MINUTES.items():
        if name in areas and areas[0] != areas[1]:
            return minutes
    if areas[0] and areas[0] == areas[1]:
        return SAME_AREA_MIN
    return DEFAULT_MIN


@tool
def get_travel_time(place_a: str, place_b: str) -> int:
    """Ước tính thời gian đi xe máy (phút) giữa hai địa điểm.
    Input: place_a, place_b (mã địa điểm). Output: số phút (int); dùng toạ độ nếu có, không thì theo khu vực.
    Là ước tính bằng code, không gọi dịch vụ chỉ đường. Không tác động ra ngoài."""
    by_id = _catalog()
    if place_a not in by_id or place_b not in by_id:
        return DEFAULT_MIN
    return _travel(by_id[place_a], by_id[place_b])


def to_min(value) -> int:
    """"08:30" hoặc 8 (giờ) → phút."""
    if isinstance(value, (int, float)):
        return int(value * 60)
    m = re.match(r"^\s*(\d{1,2})[:h](\d{2})?\s*$", str(value))
    if not m:
        raise ValueError(f"giờ không đọc được: {value!r}")
    return int(m.group(1)) * 60 + int(m.group(2) or 0)


@tool
def analyze_plan_gaps(items: list) -> list:
    """Phân loại khoảng trống giữa hai mục liên tiếp trong cùng ngày, sau khi trừ thời gian đi.
    Input: items (list[{day, id, start "HH:MM", end "HH:MM"}]).
    Output: list[{day, from_id, to_id, free_from, free_to, travel_min, gap_min, kind, categories}];
    kind: "short" (< 45 phút, không chèn), "medium" (45–90: snack, cafe), "long" (> 90: activity, sightseeing, snack).
    Không sửa plan gốc. Không tác động ra ngoài."""
    by_id = _catalog()
    days = {}
    for it in items:
        days.setdefault(int(it.get("day", 1)), []).append(it)
    gaps = []
    for day in sorted(days):
        ordered = sorted(days[day], key=lambda x: to_min(x["start"]))
        for a, b in zip(ordered, ordered[1:]):
            pa, pb = by_id.get(a.get("id")), by_id.get(b.get("id"))
            travel = _travel(pa, pb) if pa and pb else DEFAULT_MIN
            gap = to_min(b["start"]) - to_min(a["end"]) - travel
            if gap < GAP_SHORT_MAX:
                kind, cats = "short", []
            elif gap <= GAP_MEDIUM_MAX:
                kind, cats = "medium", ["snack", "cafe"]
            else:
                kind, cats = "long", ["activity", "sightseeing", "snack"]
            gaps.append({"day": day, "from_id": a.get("id"), "to_id": b.get("id"), "free_from": a["end"],
                         "free_to": b["start"], "travel_min": travel, "gap_min": gap, "kind": kind, "categories": cats})
    return gaps


@tool
def search_nearby(place_id: str, categories, max_travel_min: int = 15) -> list:
    """Tìm địa điểm cùng thành phố, đúng loại, trong giới hạn phút đi từ một điểm gốc.
    Input: place_id (mã điểm gốc), categories (list[str] hoặc chuỗi), max_travel_min (int, mặc định 15).
    Output: list dict cùng dạng search_places, thêm travel_min, xếp gần → xa; mã không có trong kho thì rỗng.
    Không tác động ra ngoài."""
    by_id = _catalog()
    origin = by_id.get(place_id)
    cats = _wanted_categories(categories)
    if not origin or not cats:
        return []
    out = []
    for p in _store(origin["city"]):
        if p["id"] == place_id or p["category"] not in cats:
            continue
        minutes = _travel(origin, p)
        if minutes <= max_travel_min:
            out.append(dict(_public(p), travel_min=minutes))
    return sorted(out, key=lambda p: (p["travel_min"], p["id"]))


@tool
def check_itinerary(items: list, budget_per_person_vnd: int, window_start: str = "", window_end: str = "") -> dict:
    """Kiểm lịch trình bằng code: giờ mở cửa, chồng giờ, đủ thời gian di chuyển, khung giờ, ngân sách/người.
    Input: items (list[{day, id, start "HH:MM", end "HH:MM"}]), budget_per_person_vnd (int, 0 = không kiểm),
    window_start/window_end ("HH:MM", tuỳ chọn).
    Output: dict {valid, total_per_person_vnd, unpriced, missing_data, violations, warnings};
    tổng chỉ cộng mục có giá; missing_data liệt kê trường kho chưa có (giờ, giá). Không tác động ra ngoài."""
    by_id = _catalog()
    violations, warnings, unpriced, missing = [], [], [], []
    total = 0
    ws = to_min(window_start) if window_start else None
    we = to_min(window_end) if window_end else None
    days = {}
    for it in items:
        days.setdefault(int(it.get("day", 1)), []).append(it)
    for day in sorted(days):
        prev = None
        for it in sorted(days[day], key=lambda x: to_min(x["start"])):
            place = by_id.get(it.get("id"))
            if not place:
                violations.append(f"Ngày {day}: mã {it.get('id')} không có trong dữ liệu công cụ.")
                continue
            s, e = to_min(it["start"]), to_min(it["end"])
            if e <= s:
                violations.append(f"Ngày {day}: {place['name']} có giờ kết thúc không sau giờ bắt đầu.")
            if not has_hours(place):
                missing.append(f"{place['name']}: giờ mở cửa")
            elif s < place["open_min"] or e > place["close_min"]:
                violations.append(f"Ngày {day}: {place['name']} chỉ mở {hhmm(place['open_min'])}–{hhmm(place['close_min'])}, "
                                  f"lịch đang xếp {hhmm(s)}–{hhmm(e)}.")
            if ws is not None and s < ws or we is not None and e > we:
                violations.append(f"Ngày {day}: {place['name']} ({hhmm(s)}–{hhmm(e)}) nằm ngoài khung {window_start}–{window_end}.")
            if prev:
                need = _travel(prev[0], place)
                if s < prev[1]:
                    violations.append(f"Ngày {day}: chồng giờ giữa {prev[0]['name']} và {place['name']}.")
                elif s - prev[1] < need:
                    violations.append(f"Ngày {day}: từ {prev[0]['name']} đến {place['name']} cần khoảng {need} phút, "
                                      f"lịch chỉ chừa {s - prev[1]} phút.")
            prev = (place, e)
            if place.get("avg_price_vnd") is None:
                unpriced.append(place["name"])
                missing.append(f"{place['name']}: giá/người")
            else:
                total += place["avg_price_vnd"]
            if is_sample(place):
                warnings.append(f"{place['name']}: giờ và giá thuộc bộ mẫu CP2, chưa xác minh.")
    if unpriced:
        warnings.append("Chưa có giá: " + ", ".join(sorted(set(unpriced))) + " (không tính vào tổng).")
    if budget_per_person_vnd and total > budget_per_person_vnd:
        violations.append(f"Tổng chi phí {total:,}đ/người vượt ngân sách {budget_per_person_vnd:,}đ/người.".replace(",", "."))
    return {"valid": not violations, "total_per_person_vnd": total, "unpriced": sorted(set(unpriced)),
            "missing_data": sorted(set(missing)), "violations": violations, "warnings": sorted(set(warnings))}

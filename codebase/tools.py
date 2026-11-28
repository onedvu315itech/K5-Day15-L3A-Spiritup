"""Công cụ của Roa — chỉ đọc, không tác động ra ngoài.

Mỗi công cụ là một hàm Python có @tool. Docstring ghi đúng 4 ý như sơ đồ ở spec.md §4:
    tên · input · output · có tác động ra ngoài không (gửi tin, sửa dữ liệu, chấm điểm…)

Dữ liệu đọc từ kho file `data/places/<slug>.json` (dựng bằng scripts/build_place_store.py).
Giờ tính theo phút từ 0h (`open_min`, `close_min`); đóng qua nửa đêm thì > 1440.
Mọi giờ, tiền, thời gian đi do code ở đây tính, model không tự nhẩm.
"""
import json
import math
import os
import re
import unicodedata

from tracing import tool, TOOLS  # noqa: F401

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE_DIR = os.path.join(ROOT, "data", "places")

# Thời gian đi xe máy khi thiếu toạ độ (bộ mẫu CP2 chỉ có khu vực). Số nhóm tự đặt ở CP2.
AREA_MINUTES = {"Cầu Đất": 45, "Trại Mát": 25}
SAME_AREA_MIN = 10
DEFAULT_MIN = 15
# Có toạ độ: đường thật ≈ 1,7 × đường chim bay (đo trên 2 chặng Routing, docs/roa-agent-design.md 2.1),
# xe máy 25 km/h trong phố, cộng 5 phút gửi xe *(tự ước tính)*.
ROAD_FACTOR, SCOOTER_KMH, PARKING_MIN = 1.7, 25, 5


def slug(text: str) -> str:
    t = unicodedata.normalize("NFD", (text or "").lower()).replace("đ", "d")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


_CACHE = {}


def _store(city: str) -> list:
    key = slug(city)
    if key not in _CACHE:
        path = os.path.join(STORE_DIR, f"{key}.json")
        if not key or not os.path.exists(path):
            _CACHE[key] = []
        else:
            with open(path, encoding="utf-8") as f:
                _CACHE[key] = json.load(f)["places"]
    return _CACHE[key]


def _all_places() -> dict:
    out = {}
    if os.path.isdir(STORE_DIR):
        for name in os.listdir(STORE_DIR):
            if name.endswith(".json"):
                for p in _store(name[:-5]):
                    out[p["id"]] = p
    return out


def supported_cities() -> list:
    """Các thành phố đã có kho (tên hiển thị)."""
    cities = []
    if os.path.isdir(STORE_DIR):
        for name in sorted(os.listdir(STORE_DIR)):
            if name.endswith(".json"):
                places = _store(name[:-5])
                if places:
                    cities.append(places[0]["city"])
    return cities


def hhmm(minutes: int) -> str:
    minutes = int(minutes) % (24 * 60) if minutes != 24 * 60 else 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _public(p: dict) -> dict:
    return {
        "id": p["id"], "name": p["name"], "category": p["category"], "area": p.get("area"),
        "open": hhmm(p["open_min"]), "close": hhmm(p["close_min"]),
        "avg_price_vnd": p.get("avg_price_vnd"),
        "vegetarian_friendly": p.get("vegetarian_friendly"),
        "is_hot": p.get("is_hot", False), "source": p.get("source"),
    }


@tool
def search_places(city: str, preference: str = "", category: str = "") -> list:
    """Tra địa điểm trong kho theo thành phố, sở thích và loại.
    Input: city (str), preference (str, vd "chay"), category ("cafe" | "food" | "sightseeing" | "").
    Output: danh sách dict {id, name, category, area, open, close, avg_price_vnd, vegetarian_friendly, is_hot, source};
    rỗng nếu thành phố chưa có kho. Không tác động ra ngoài."""
    rows = _store(city)
    if category:
        rows = [p for p in rows if p["category"] == category]
    if "chay" in (preference or "").lower():
        rows = [p for p in rows if p.get("vegetarian_friendly")]
    return [_public(p) for p in rows]


@tool
def get_trending_spots(city: str) -> list:
    """Lấy danh sách quán đang hot từ kho thu trước theo thành phố.
    Input: city (str). Output: danh sách dict quán hot (cùng dạng search_places). Không tác động ra ngoài."""
    return [_public(p) for p in _store(city) if p.get("is_hot")]


@tool
def get_opening_hours(place_ids: list) -> dict:
    """Tra giờ mở cửa và đóng cửa của các địa điểm theo mã.
    Input: place_ids (list[str]). Output: dict {id: {name, open, close}}; mã không có trong kho thì bỏ qua.
    Không tác động ra ngoài."""
    by_id = _all_places()
    return {pid: {"name": by_id[pid]["name"], "open": hhmm(by_id[pid]["open_min"]), "close": hhmm(by_id[pid]["close_min"])}
            for pid in place_ids if pid in by_id}


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
    by_id = _all_places()
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
def check_itinerary(items: list, budget_per_person_vnd: int, window_start: str = "", window_end: str = "") -> dict:
    """Kiểm lịch trình bằng code: giờ mở cửa, chồng giờ, đủ thời gian di chuyển, khung giờ, ngân sách/người.
    Input: items (list[{day, id, start "HH:MM", end "HH:MM"}]), budget_per_person_vnd (int, 0 = không kiểm),
    window_start/window_end ("HH:MM", tuỳ chọn).
    Output: dict {valid, total_per_person_vnd, unpriced, violations, warnings}. Không tác động ra ngoài."""
    by_id = _all_places()
    violations, warnings, unpriced = [], [], []
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
            if s < place["open_min"] or e > place["close_min"]:
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
            else:
                total += place["avg_price_vnd"]
            if place.get("source") == "mau_cp2":
                warnings.append(f"{place['name']}: giờ và giá thuộc bộ mẫu CP2, chưa xác minh.")
    if unpriced:
        warnings.append("Chưa có giá: " + ", ".join(sorted(set(unpriced))) + " (không tính vào tổng).")
    if budget_per_person_vnd and total > budget_per_person_vnd:
        violations.append(f"Tổng chi phí {total:,}đ/người vượt ngân sách {budget_per_person_vnd:,}đ/người.".replace(",", "."))
    return {"valid": not violations, "total_per_person_vnd": total, "unpriced": sorted(set(unpriced)),
            "violations": violations, "warnings": sorted(set(warnings))}

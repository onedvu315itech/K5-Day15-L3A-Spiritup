"""Công cụ của bài toán — NHÓM VIẾT. Điền ở guide bước 2.2 (thiết kế) và 3.2 (code).

Mỗi công cụ là một hàm Python có @tool. Docstring ghi đúng 4 ý như sơ đồ ở spec.md §4:
    tên · input · output · có tác động ra ngoài không (gửi tin, sửa dữ liệu, chấm điểm…)
"""
from tracing import tool, TOOLS  # noqa: F401

MOCK_PLACES = [
    {"id": "DL-01", "name": "Tiệm Cà Phê Túi Mơ To", "city": "Đà Lạt", "category": "cafe", "area": "Trại Mát", "open_hour": 7, "close_hour": 21, "avg_price_vnd": 65000, "vegetarian_friendly": True, "is_hot": True},
    {"id": "DL-02", "name": "Bánh Căn Lệ", "city": "Đà Lạt", "category": "food", "area": "Trung tâm", "open_hour": 7, "close_hour": 10, "avg_price_vnd": 50000, "vegetarian_friendly": False, "is_hot": True},
    {"id": "DL-03", "name": "Lẩu Gà Lá É Tao Ngộ", "city": "Đà Lạt", "category": "food", "area": "Trung tâm", "open_hour": 10, "close_hour": 22, "avg_price_vnd": 150000, "vegetarian_friendly": False, "is_hot": True},
    {"id": "DL-04", "name": "Nhà Hàng Chay Hoa Sen", "city": "Đà Lạt", "category": "food", "area": "Trung tâm", "open_hour": 9, "close_hour": 21, "avg_price_vnd": 90000, "vegetarian_friendly": True, "is_hot": False},
    {"id": "DL-05", "name": "Quán Nướng Ngói Cu Đức", "city": "Đà Lạt", "category": "food", "area": "Trung tâm", "open_hour": 11, "close_hour": 22, "avg_price_vnd": 200000, "vegetarian_friendly": True, "is_hot": True},
    {"id": "DL-06", "name": "Đồi Chè Cầu Đất", "city": "Đà Lạt", "category": "sightseeing", "area": "Cầu Đất", "open_hour": 5, "close_hour": 17, "avg_price_vnd": 0, "vegetarian_friendly": True, "is_hot": True},
    {"id": "DL-07", "name": "Vườn Hoa Thành Phố", "city": "Đà Lạt", "category": "sightseeing", "area": "Hồ Xuân Hương", "open_hour": 7, "close_hour": 18, "avg_price_vnd": 100000, "vegetarian_friendly": True, "is_hot": False},
    {"id": "DL-08", "name": "Still Cafe", "city": "Đà Lạt", "category": "cafe", "area": "Trung tâm", "open_hour": 8, "close_hour": 22, "avg_price_vnd": 60000, "vegetarian_friendly": True, "is_hot": True},
]


@tool
def search_places(city: str, preference: str = "") -> list:
    """Tra địa điểm trong kho theo thành phố và sở thích.
    Input: city (str), preference (str). Output: danh sách dict địa điểm. Không tác động ra ngoài."""
    if "đà lạt" not in city.lower() and "da lat" not in city.lower():
        return []
    if "chay" in preference.lower():
        return [p for p in MOCK_PLACES if p["vegetarian_friendly"]]
    return list(MOCK_PLACES)


@tool
def get_trending_spots(city: str) -> list:
    """Lấy danh sách quán đang hot từ kho thu trước theo thành phố.
    Input: city (str). Output: danh sách dict quán hot. Không tác động ra ngoài."""
    if "đà lạt" not in city.lower() and "da lat" not in city.lower():
        return []
    return [p for p in MOCK_PLACES if p["is_hot"]]


@tool
def get_opening_hours(place_ids: list) -> dict:
    """Tra giờ mở cửa và đóng cửa của các địa điểm theo mã.
    Input: place_ids (list[str]). Output: dict {id: {name, open_hour, close_hour}}. Không tác động ra ngoài."""
    by_id = {p["id"]: p for p in MOCK_PLACES}
    return {
        pid: {"name": by_id[pid]["name"], "open_hour": by_id[pid]["open_hour"], "close_hour": by_id[pid]["close_hour"]}
        for pid in place_ids
        if pid in by_id
    }


@tool
def get_travel_time(area_a: str, area_b: str) -> int:
    """Ước tính thời gian di chuyển (phút) giữa hai khu vực tại Đà Lạt.
    Input: area_a (str), area_b (str). Output: số phút di chuyển (int). Không tác động ra ngoài."""
    if area_a == area_b:
        return 10
    if "Cầu Đất" in (area_a, area_b):
        return 45
    if "Trại Mát" in (area_a, area_b):
        return 25
    return 15


@tool
def check_itinerary(items: list, budget_per_person_vnd: int) -> dict:
    """Kiểm tra giờ mở cửa, chồng giờ và tổng ngân sách/người bằng code.
    Input: items (list[{id, start_hour, end_hour}]), budget_per_person_vnd (int).
    Output: dict {valid, total_per_person_vnd, violations}. Không tác động ra ngoài."""
    by_id = {p["id"]: p for p in MOCK_PLACES}
    violations = []
    total = 0
    prev_end = -1
    for item in sorted(items, key=lambda x: x.get("start_hour", 0)):
        pid = item.get("id")
        place = by_id.get(pid)
        if not place:
            violations.append(f"Không tìm thấy mã địa điểm {pid} trong dữ liệu.")
            continue
        start_h = item.get("start_hour", 0)
        end_h = item.get("end_hour", start_h + 1)
        if start_h < place["open_hour"] or end_h > place["close_hour"]:
            violations.append(f"{place['name']} chỉ mở {place['open_hour']}h-{place['close_hour']}h (lịch đang xếp {start_h}h-{end_h}h).")
        if start_h < prev_end:
            violations.append(f"Bị chồng giờ tại {place['name']} ({start_h}h).")
        prev_end = end_h
        total += place["avg_price_vnd"]
    if budget_per_person_vnd > 0 and total > budget_per_person_vnd:
        violations.append(f"Tổng chi phí {total:,}đ/người vượt ngân sách {budget_per_person_vnd:,}đ/người.")
    return {"valid": len(violations) == 0, "total_per_person_vnd": total, "violations": violations}

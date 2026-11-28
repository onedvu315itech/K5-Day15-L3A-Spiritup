"""Dựng kho địa điểm cho Roa từ bộ mẫu CP2 và danh mục Geoapify đã tải.

    python scripts/build_place_store.py --geoapify data/raw/geoapify-da-lat-<stamp>.json \
        --city "Đà Lạt" --out data/places/da-lat.json

- Bộ mẫu CP2 (`DL-01`–`DL-08`) giữ nguyên mã và số liệu vì bộ câu thử B01–B10 viết theo nó.
  Nhãn `mau_cp2`: giờ, giá là số nhóm tự đặt, không có nguồn.
- Từ Geoapify (OSM) chỉ lấy nơi có tên, không có dấu hiệu đóng cửa, và giờ mở cửa đọc được
  ở dạng một khung giờ áp cho mọi ngày (`Mo-Su 07:00-22:00`, `07:00-22:00`, `24/7`).
  Dạng khác (chia ca, theo thứ) bỏ qua để không đọc sai giờ.
- Không đoán giá: nơi OSM có `avg_price_vnd = null`.
Không gọi mạng, không cần key.
"""
import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Bộ mẫu CP2, chép nguyên từ codebase/tools.py (bản CP2).
SEED = [
    {"id": "DL-01", "name": "Tiệm Cà Phê Túi Mơ To", "category": "cafe", "area": "Trại Mát", "open_hour": 7, "close_hour": 21, "avg_price_vnd": 65000, "vegetarian_friendly": True, "is_hot": True},
    {"id": "DL-02", "name": "Bánh Căn Lệ", "category": "food", "area": "Trung tâm", "open_hour": 7, "close_hour": 10, "avg_price_vnd": 50000, "vegetarian_friendly": False, "is_hot": True},
    {"id": "DL-03", "name": "Lẩu Gà Lá É Tao Ngộ", "category": "food", "area": "Trung tâm", "open_hour": 10, "close_hour": 22, "avg_price_vnd": 150000, "vegetarian_friendly": False, "is_hot": True},
    {"id": "DL-04", "name": "Nhà Hàng Chay Hoa Sen", "category": "food", "area": "Trung tâm", "open_hour": 9, "close_hour": 21, "avg_price_vnd": 90000, "vegetarian_friendly": True, "is_hot": False},
    {"id": "DL-05", "name": "Quán Nướng Ngói Cu Đức", "category": "food", "area": "Trung tâm", "open_hour": 11, "close_hour": 22, "avg_price_vnd": 200000, "vegetarian_friendly": True, "is_hot": True},
    {"id": "DL-06", "name": "Đồi Chè Cầu Đất", "category": "sightseeing", "area": "Cầu Đất", "open_hour": 5, "close_hour": 17, "avg_price_vnd": 0, "vegetarian_friendly": True, "is_hot": True},
    {"id": "DL-07", "name": "Vườn Hoa Thành Phố", "category": "sightseeing", "area": "Hồ Xuân Hương", "open_hour": 7, "close_hour": 18, "avg_price_vnd": 100000, "vegetarian_friendly": True, "is_hot": False},
    {"id": "DL-08", "name": "Still Cafe", "category": "cafe", "area": "Trung tâm", "open_hour": 8, "close_hour": 22, "avg_price_vnd": 60000, "vegetarian_friendly": True, "is_hot": True},
]

GROUP_TO_CATEGORY = {"cafe": "cafe", "food": "food", "sight": "sightseeing"}
EVERYDAY = re.compile(r"^(?:Mo-Su\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")
WARD = re.compile(r"(Phường [^,]+?)(?: - [^,]+)?,")


def parse_hours(text):
    """Trả (mở, đóng) theo phút từ 0h; đóng qua nửa đêm thì cộng 24h. Không đọc được thì None."""
    if not text:
        return None
    text = text.strip()
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


def seed_rows(city, today):
    rows = []
    for s in SEED:
        r = dict(s)
        r.update({
            "city": city,
            "open_min": s["open_hour"] * 60,
            "close_min": s["close_hour"] * 60,
            "lat": None, "lon": None, "address": None,
            "source": "mau_cp2",
            "source_note": "Bộ mẫu CP2 nhóm tự đặt; giờ và giá chưa có nguồn",
            "fetched_at": "2026-11-27",
        })
        rows.append(r)
    return rows


def osm_rows(path, city):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    seen, rows = set(), []
    for group, block in data["groups"].items():
        category = GROUP_TO_CATEGORY.get(group)
        for p in block.get("places", []):
            name = (p.get("name") or "").strip()
            hours = parse_hours(p.get("opening_hours"))
            if not category or not name or not hours or p.get("maybe_closed") or not p.get("osm"):
                continue
            if p["osm"] in seen:
                continue
            seen.add(p["osm"])
            ward = WARD.search(p.get("address") or "")
            cuisine = (p.get("cuisine") or "").lower()
            veg = True if ("vegetarian" in cuisine or "vegan" in cuisine or " chay" in f" {name.lower()}") else None
            rows.append({
                "id": f"osm:{p['osm']}",
                "name": name,
                "city": city,
                "category": category,
                "area": ward.group(1) if ward else None,
                "open_min": hours[0],
                "close_min": hours[1],
                "opening_hours_raw": p.get("opening_hours"),
                "avg_price_vnd": None,
                "vegetarian_friendly": veg,
                "is_hot": False,
                "lat": p.get("lat"), "lon": p.get("lon"),
                "address": p.get("address"),
                "website": p.get("website"),
                "source": "osm_geoapify",
                "source_note": "© OpenStreetMap contributors (ODbL), qua Geoapify Places",
                "fetched_at": "2026-11-27",
            })
    rows.sort(key=lambda r: (r["category"], r["name"]))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geoapify", required=True)
    ap.add_argument("--city", default="Đà Lạt")
    ap.add_argument("--out", default=str(ROOT / "data" / "places" / "da-lat.json"))
    args = ap.parse_args()
    today = date.today().isoformat()
    places = seed_rows(args.city, today) + osm_rows(args.geoapify, args.city)
    store = {
        "city": args.city,
        "built_at": today,
        "attribution": "Dữ liệu địa điểm © OpenStreetMap contributors (ODbL). Powered by Geoapify.",
        "places": places,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(store, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    by = {}
    for p in places:
        by[(p["source"], p["category"])] = by.get((p["source"], p["category"]), 0) + 1
    print(f"ghi {out.relative_to(ROOT)}: {len(places)} nơi")
    for k, v in sorted(by.items()):
        print(f"  {k[0]:13} {k[1]:12} {v}")


if __name__ == "__main__":
    sys.exit(main())

"""Công cụ dữ liệu và kiểm lịch của Roa. Mọi giá và giờ chưa biết giữ là None."""
import json
import math
import os
from pathlib import Path
import re
import tempfile
from threading import RLock
import unicodedata
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

if __package__:
    from .tracing import note, tool, TOOLS
else:
    from tracing import note, tool, TOOLS

DATA = Path(__file__).resolve().parents[1] / "data"
MAPS = "cache_maps.json"
LOOKUP = "cache_lookup.json"
_LOCK = RLock()
# Bản chi tiết Google phục vụ các bước liên tiếp của lượt chạy, chỉ ID ghi ra đĩa.
_google_places = {}
DRIVING_KMH = 30  # tự ước tính cho đường đô thị
CATEGORIES = {
    "cafe": ("cafe", "ca phe", "coffee", "coffee shop"),
    "snack": ("snack", "an vat", "dac san", "specialty", "bakery", "dessert"),
    "sightseeing": ("sightseeing", "tham quan", "tourist attraction", "museum", "park", "bao tang"),
    "activity": ("activity", "vui choi", "giai tri", "amusement park"),
    "food": ("food", "am thuc", "quan an", "nha hang", "restaurant"),
}
DETAIL_FIELDS = ("open_hour", "close_hour", "avg_price_vnd")

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

def _norm(value):
    value = unicodedata.normalize("NFKD", str(value or "").casefold().replace("đ", "d"))
    return " ".join(re.findall(r"[a-z0-9]+", "".join(c for c in value if not unicodedata.combining(c))))


def _city(value):
    name = re.sub(r"^(?:thanh pho|tp) ", "", _norm(value))
    return "ho chi minh" if name in {"hcm", "tphcm", "sai gon", "saigon"} else name


def _contains(text, phrase):
    return bool(phrase) and f" {phrase} " in f" {text} "


def _categories(text):
    return {cat for cat, words in CATEGORIES.items() if any(_contains(text, w) for w in words)}


def _read(path, default):
    try:
        with path.open(encoding="utf-8-sig") as stream:
            value = json.load(stream)
        return value if isinstance(value, type(default)) else default
    except (OSError, ValueError):
        return default


def _cache(filename):
    return _read(DATA / "raw" / filename, {})


def _write_cache(filename, key, value):
    folder = DATA / "raw"
    # Khóa cả giữa các tiến trình để hai lượt eval không ghi mất khóa của nhau.
    folder.mkdir(parents=True, exist_ok=True)
    with _LOCK, (folder / (filename + ".lock")).open("a+b") as lock:
        if os.name == "nt":
            import msvcrt
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX)
        entries = _cache(filename)
        entries[key] = value
        tmp = tempfile.NamedTemporaryFile(dir=folder, delete=False, mode="w", encoding="utf-8")
        try:
            with tmp:
                json.dump(entries, tmp, ensure_ascii=False)
            os.replace(tmp.name, folder / filename)
        finally:
            Path(tmp.name).unlink(missing_ok=True)


def _save(filename, key, value):
    try:
        _write_cache(filename, key, value)
    except OSError:
        note(f"Không ghi được {filename}. Dùng kết quả API cho lượt hiện tại.")


def _request(url, *, headers=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, headers={"Content-Type": "application/json", **(headers or {})})
    with urlopen(req, timeout=8) as response:
        return json.load(response)


def _key(*parts):
    return json.dumps(parts, ensure_ascii=False)


def _filter(rows, preference):
    text = _norm(preference)
    exact = [p for p in rows if text and _norm(p["name"]) == text]
    if exact:
        return exact
    cats = _categories(text)
    veg = _contains(text, "chay") or _contains(text, "vegetarian")
    hot = _contains(text, "hot") or _contains(text, "trending")
    if text and not (cats or veg or hot or _is_trip_request(text)):
        return [p for p in rows if _contains(_norm(p["name"]), text)]
    return [p for p in rows if (not cats or p.get("category") in cats)
            and (not veg or p.get("vegetarian_friendly")) and (not hot or p.get("is_hot"))]


def _is_trip_request(text):
    # answer(text) cũng truyền nguyên câu mô tả chuyến đi vào preference.
    return any(_contains(text, w) for w in ("lich", "nhom", "nguoi", "di", "ngay", "buoi"))


def _city_rows(rows, city):
    return [p for p in rows if _city(p["city"]) == _city(city)]


def _daily_hours(periods):
    # Plan chưa có thứ trong tuần. Chỉ nhận một khung giờ giống nhau cả bảy ngày.
    if (len(periods) == 1 and "close" not in periods[0] and
            periods[0].get("open", {}).get("day") == 0 and
            periods[0]["open"].get("hour", 0) == periods[0]["open"].get("minute", 0) == 0):
        return 0, 24
    windows = {}
    for period in periods:
        start, end = period.get("open", {}), period.get("close", {})
        day = start.get("day")
        if day in windows or day is None or start.get("hour") is None or end.get("hour") is None:
            return None, None
        a = start["hour"] + start.get("minute", 0) / 60
        b = end["hour"] + end.get("minute", 0) / 60
        if b == 0 and end.get("day") == (day + 1) % 7:
            b = 24
        elif end.get("day") != day:
            return None, None
        if a >= b:
            return None, None
        windows[day] = (a, b)
    if len(windows) == 7 and len(set(windows.values())) == 1:
        return windows[0]
    return None, None


GOOGLE_URL = "https://places.googleapis.com/v1/places"
GOOGLE_FIELDS = ("id", "displayName", "formattedAddress", "location", "types", "regularOpeningHours",
                 "servesVegetarianFood")


def _map_row(pid, name, city, area, lat, lon, kinds, source):
    cats = _categories(_norm(kinds)) | _categories(_norm(name))
    return {"id": pid, "name": name, "city": city, "area": area, "lat": lat, "lon": lon,
            "category": next((c for c in CATEGORIES if c in cats), None),
            "source": source, "open_hour": None, "close_hour": None,
            "avg_price_vnd": None, "vegetarian_friendly": None, "is_hot": None}


def _google_row(raw, city):
    pid, name = raw.get("id"), raw.get("displayName", {}).get("text")
    if not pid or not name:
        return None
    loc = raw.get("location", {})
    row = _map_row(pid, name, city, raw.get("formattedAddress"), loc.get("latitude"),
                   loc.get("longitude"), " ".join(raw.get("types", [])), "Google Maps")
    periods = raw.get("regularOpeningHours", {}).get("periods", [])
    row["open_hour"], row["close_hour"] = _daily_hours(periods)
    row["vegetarian_friendly"] = raw.get("servesVegetarianFood")
    _google_places[pid] = row
    return row


def _google(city, query, token, cached):
    headers = {"X-Goog-Api-Key": token}
    if cached is not None:
        rows = []
        for pid in cached:
            row = _google_places.get(pid)
            if row is None:
                raw = _request(GOOGLE_URL + "/" + quote(pid, safe=""),
                               headers={**headers, "X-Goog-FieldMask": ",".join(GOOGLE_FIELDS)})
                row = _google_row(raw, city)
            if row:
                rows.append(row)
        return rows
    fields = ",".join("places." + f for f in GOOGLE_FIELDS)
    raw = _request(GOOGLE_URL + ":searchText", headers={**headers, "X-Goog-FieldMask": fields},
                   body={"textQuery": query, "languageCode": "vi", "regionCode": "VN", "pageSize": 10})
    return [row for p in raw.get("places", [])
            if _contains(_norm(p.get("formattedAddress")), _city(city)) and (row := _google_row(p, city))]


def _vietmap(city, query, token):
    base = "https://maps.vietmap.vn/api/"
    params = {"apikey": token, "text": query, "layers": "POI"}
    hits = _request(base + "autocomplete/v4?" + urlencode(params))
    rows = []
    for hit in hits[:10]:
        ref = hit.get("ref_id")
        if not ref:
            continue
        p = _request(base + "place/v4?" + urlencode({"apikey": token, "refid": ref}))
        name = p.get("name") or hit.get("name")
        if name and _contains(_norm(p.get("display") or hit.get("display")), _city(city)):
            rows.append(_map_row("vietmap:" + ref, name, city, p.get("ward"), p.get("lat"),
                                 p.get("lng"), name, "VIETMAP"))
    return rows


@tool
def search_places(city: str, preference: str = "") -> list:
    """Tên: search_places — tìm địa điểm theo thành phố và sở thích.
    Input: city, preference (loại, chay, hot hoặc tên).
    Output: danh sách địa điểm kèm mã, nguồn và dữ liệu đã biết.
    Tác động ra ngoài: đọc kho, có thể gọi bản đồ và ghi cache cục bộ.
    """
    local = _city_rows(_read(DATA / "places_vn.json", []), city)
    if local:
        return _filter(local, preference)
    if not _city(city) or _city(city) == "khac":
        return []
    cache = _cache(MAPS)
    cats = _categories(_norm(preference))
    labels = {"cafe": "cà phê", "snack": "ăn vặt", "activity": "vui chơi",
              "food": "quán ăn", "sightseeing": "tham quan"}
    terms = [label for c, label in labels.items() if c in cats]
    subject = ", ".join(terms) or ("" if _is_trip_request(_norm(preference)) else preference.strip())
    subject = subject or "địa điểm du lịch"
    if _contains(_norm(preference), "chay"):
        subject += " chay"
    query = f"{subject} tại {city}, Việt Nam"
    for provider, env in (("google", "GOOGLE_MAPS_API_KEY"), ("vietmap", "VIETMAP_API_KEY")):
        key = _key(provider, _city(city), subject)
        cached = cache.get(key)
        token = os.getenv(env)
        if cached == []:
            continue
        if provider == "vietmap" and cached is not None:
            return _filter(cached, preference)
        if not token and not (provider == "google" and cached and all(p in _google_places for p in cached)):
            continue
        try:
            if provider == "google":
                rows = _google(city, query, token, cached)
                cache_value = [p["id"] for p in rows]
            else:
                rows = _vietmap(city, query, token)
                cache_value = rows
            if cached is None:
                _save(MAPS, key, cache_value)
            if rows:
                return _filter(rows, preference)
        except (OSError, ValueError):
            continue
    return _filter([dict(p, source="mock_cp2") for p in _city_rows(MOCK_PLACES, city)], preference)


@tool
def get_trending_spots(city: str) -> list:
    """Tên: get_trending_spots — tìm điểm đang được quan tâm.
    Input: city.
    Output: danh sách bản ghi thu trước của thành phố, có thể rỗng.
    Tác động ra ngoài: chỉ đọc kho cục bộ.
    """
    return _city_rows(_read(DATA / "trending_spots.json", []), city)


def _catalog():
    local = _read(DATA / "places_vn.json", [])
    cities = {_city(p["city"]) for p in local}
    places = {p["id"]: dict(p, source="mock_cp2") for p in MOCK_PLACES if _city(p["city"]) not in cities}
    for rows in _cache(MAPS).values():
        for p in rows:
            if isinstance(p, dict):
                places[p["id"]] = p
    places.update(_google_places)
    places.update((p["id"], p) for p in local)
    details = _cache(LOOKUP)
    for pid, p in places.items():
        extra = details.get(_key(_city(p["city"]), _norm(p["name"]))) or {}
        places[pid] = {**p, **{k: extra[k] for k in DETAIL_FIELDS if p.get(k) is None and k in extra}}
    return places


@tool
def get_opening_hours(place_ids: list) -> dict:
    """Tên: get_opening_hours — tra giờ theo mã địa điểm.
    Input: danh sách place_ids.
    Output: dict theo mã với name, open_hour, close_hour. Mã lạ trả None.
    Tác động ra ngoài: chỉ đọc kho và cache.
    """
    catalog = _catalog()
    return {pid: {k: catalog[pid].get(k) for k in ("name", "open_hour", "close_hour")}
            if pid in catalog else None for pid in place_ids}


def _coords(value):
    if isinstance(value, dict):
        value = value.get("coords") or (value.get("lat"), value.get("lon", value.get("lng")))
    if isinstance(value, (list, tuple)) and len(value) == 2:
        lat, lon = value
        if all(isinstance(n, (int, float)) for n in value) and abs(lat) <= 90 and abs(lon) <= 180:
            return lat, lon
    return None


@tool
def get_travel_time(origin=None, destination=None, *, area_a=None, area_b=None) -> int | None:
    """Tên: get_travel_time — ước tính thời gian đi.
    Input: hai cặp (lat, lon), hai địa điểm hoặc hai tên khu vực.
    Output: số phút làm tròn lên, None khi thiếu vị trí.
    Tác động ra ngoài: không.
    """
    origin = origin if origin is not None else area_a
    destination = destination if destination is not None else area_b
    a, b = _coords(origin), _coords(destination)
    if a and b:
        lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
        h = (math.sin((lat2 - lat1) / 2) ** 2
             + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
        km = 2 * 6371 * math.asin(math.sqrt(min(1, h)))
        return math.ceil(km * 1.7 / DRIVING_KMH * 60)
    areas = [v.get("area") if isinstance(v, dict) else v for v in (origin, destination)]
    if not all(isinstance(v, str) and v.strip() for v in areas):
        return None
    first, second = map(_norm, areas)
    if first == second:
        return 10
    if "cau dat" in (first, second):
        return 45
    if "trai mat" in (first, second):
        return 25
    return 15


# Mẫu đòi đơn vị tiền và mẫu số "người". Không chuyển giá món, giá phòng hay khoảng giá thành giá/người.
_CLOCK = r"(\d{1,2})(?:[:h](\d{2})|h)?"
_HOURS = re.compile(r"(?:giờ (?:mở cửa|hoạt động)|mở cửa)\s*[:：]?\s*(?:từ\s+)?"
                    + _CLOCK + r"\s*(?:[-–—]|đến|tới)\s*" + _CLOCK + r"(?![\d:h])", re.I)
_PRICE = re.compile(r"(?<![\w.,])(\d{1,3}(?:[., ]\d{3})+|\d+)\s*"
                    r"(vnd|vnđ|đồng|đ|₫|k|nghìn|ngàn)\s*(?:/|mỗi|một)\s*(?:người|khách)\b", re.I)
_RANGE_END = re.compile(r"(?:[-–—]|đến|tới|từ|khoảng|tối đa|tối thiểu)\s*$", re.I)
_VARIABLE_HOURS = re.compile(r"thứ\s+[2-7a-zà-ỹ]+|chủ nhật|cuối tuần|ngày lễ|[Tt][2-7]\b", re.I)


def _extract_details(results, name, city):
    prices, hours = {}, {}
    for hit in results:
        url = hit.get("url") or ""
        snippet = hit.get("content") or ""
        title = hit.get("title") or ""
        identity = _norm(title + " " + snippet)
        # Chỉ dùng trang về chính địa điểm; bài tổng hợp dễ gán nhầm giá của quán khác.
        heading = _norm(title or snippet.split(".", 1)[0])
        if not (url.startswith(("https://", "http://")) and _contains(heading, _norm(name))
                and (_contains(identity, _city(city)) or _contains(identity, _norm(city)))):
            continue
        if any(_contains(_norm(title), w) for w in ("top", "danh sach", "tong hop")):
            continue
        for m in _PRICE.finditer(snippet):
            if not _RANGE_END.search(snippet[:m.start()]):
                amount = int(re.sub(r"[., ]", "", m[1]))
                if m[2].lower() in {"k", "nghìn", "ngàn"}:
                    amount *= 1000
                prices[amount] = url
        if not _VARIABLE_HOURS.search(snippet):
            for m in _HOURS.finditer(snippet):
                a, am, b, bm = (int(v or 0) for v in m.groups())
                start, end = a + am / 60, b + bm / 60
                if am < 60 and bm < 60 and 0 <= start < end <= 24:
                    hours[(start, end)] = url
    result = dict.fromkeys(DETAIL_FIELDS)
    sources = {}
    if len(prices) == 1:
        result["avg_price_vnd"], sources["avg_price_vnd"] = next(iter(prices.items()))
    if len(hours) == 1:
        window, sources["opening_hours"] = next(iter(hours.items()))
        result["open_hour"], result["close_hour"] = window
    return {**result, "sources": sources} if sources else None


@tool
def lookup_place_details(name: str, city: str) -> dict | None:
    """Tên: lookup_place_details — tra bổ sung giờ và giá/người của một điểm.
    Input: tên địa điểm và thành phố.
    Output: open_hour, close_hour, avg_price_vnd cùng nguồn. Thiếu từng trường hoặc cả kết quả trả None.
    Tác động ra ngoài: đọc/ghi cache cục bộ và có thể gửi tên, thành phố đến Tavily.
    """
    key = _key(_city(city), _norm(name))
    if not _norm(name) or not _city(city):
        return None
    cache = _cache(LOOKUP)
    if key in cache:
        return cache[key]
    token = os.getenv("TAVILY_API_KEY")
    if not token:
        return None
    try:
        data = _request("https://api.tavily.com/search", headers={"Authorization": "Bearer " + token},
                        body={"query": f'"{name}" "{city}" giờ mở cửa và giá vé hoặc giá trung bình/người',
                              "max_results": 4, "include_answer": False})
        if not isinstance(data.get("results"), list):
            return None
        result = _extract_details(data["results"], name, city)
        _save(LOOKUP, key, result)
        return result
    except (OSError, ValueError):
        return None


def _plan_items(items):
    catalog = _catalog()
    for item in sorted(items, key=lambda i: (i.get("day", 1), i.get("start_hour", 0))):
        pid = item.get("place_id") or item.get("id")
        place = catalog.get(pid, {})
        # ID của mục lịch có thể khác mã địa điểm. Ưu tiên trường đã biết trong kho.
        merged = {**item, **{k: v for k, v in place.items() if v is not None}}
        merged.update(day=item.get("day", 1), place_id=pid, id=item.get("id", pid),
                      start_hour=item.get("start_hour", 0), known=bool(place))
        merged.setdefault("end_hour", merged["start_hour"] + 1)
        yield merged


def _leg(previous, current):
    if previous is None or previous["day"] != current["day"]:
        return None, None
    elapsed = round((current["start_hour"] - previous["end_hour"]) * 60, 8)
    return elapsed, get_travel_time(previous, current)


@tool
def analyze_plan_gaps(items: list) -> list:
    """Tên: analyze_plan_gaps — phân loại khoảng trống giữa hai mục liên tiếp trong ngày.
    Input: items có day, start_hour, end_hour và mã hoặc vị trí.
    Output: từng cặp mục, travel_min, gap_min sau di chuyển, loại và categories đề nghị.
    Tác động ra ngoài: chỉ đọc kho và cache. Giữ nguyên plan gốc.
    """
    gaps = []
    previous = None
    for current in _plan_items(items):
        elapsed, travel = _leg(previous, current)
        if elapsed is not None:
            gap = elapsed - travel if travel is not None else None
            if gap is None:
                kind, cats = "unknown", []
            elif gap < 45:
                kind, cats = "short", []
            elif gap <= 90:
                kind, cats = "medium", ["snack", "cafe"]
            else:
                kind, cats = "long", ["activity", "sightseeing", "snack"]
            gaps.append({"day": current["day"], "from_id": previous["id"], "to_id": current["id"],
                         "origin_place_id": previous["place_id"], "travel_min": travel,
                         "gap_min": gap, "kind": kind, "categories": cats})
        previous = current
    return gaps


@tool
def search_nearby(place_id_or_coords, city: str, categories, max_travel_min: int = 15) -> list:
    """Tên: search_nearby — tìm điểm trong giới hạn di chuyển.
    Input: mã điểm gốc hoặc (lat, lon), city, categories, max_travel_min.
    Output: danh sách địa điểm kèm travel_min, xếp từ gần đến xa.
    Tác động ra ngoài: đọc kho, có thể gọi bản đồ và ghi cache khi tra ứng viên.
    """
    cats = _categories(_norm(categories if isinstance(categories, str) else " ".join(categories)))
    if not cats:
        return []
    origin = place_id_or_coords
    if isinstance(origin, str):
        origin = _catalog().get(origin)
        if not origin or _city(origin["city"]) != _city(city):
            return []
    if not _coords(origin) and not (isinstance(origin, dict) and origin.get("area")):
        return []
    candidates = {p["id"]: p for p in search_places(city, " ".join(sorted(cats)))}
    # Tận dụng cả ứng viên đã lưu từ truy vấn khác trong cùng thành phố.
    for p in _city_rows(_catalog().values(), city):
        if p.get("source") != "mock_cp2" or p["id"] in candidates:
            candidates[p["id"]] = p
    nearby = []
    for p in candidates.values():
        if p.get("category") not in cats or (isinstance(origin, dict) and p["id"] == origin.get("id")):
            continue
        if not isinstance(origin, dict) and _coords(origin) == _coords(p) and _coords(p) is not None:
            continue
        minutes = get_travel_time(origin, p)
        if minutes is not None and minutes <= max_travel_min:
            nearby.append({**p, "travel_min": minutes})
    return sorted(nearby, key=lambda p: (p["travel_min"], p["id"]))


@tool
def check_itinerary(items: list, budget_per_person_vnd: int) -> dict:
    """Tên: check_itinerary — kiểm lịch từng ngày và tổng chi phí đã biết.
    Input: danh sách mục có mã, ngày, giờ bắt đầu/kết thúc và ngân sách/người toàn chuyến.
    Output: valid (không có vi phạm đã biết), violations, total_per_person_vnd và missing_data.
    Tác động ra ngoài: chỉ đọc kho và cache.
    """
    total = 0
    violations, missing = [], []
    previous = None
    for p in _plan_items(items):
        start, end = p["start_hour"], p["end_hour"]
        name = p.get("name") or p["place_id"]
        absent = [k for k in DETAIL_FIELDS if p.get(k) is None]
        if not p["known"] and not p.get("name") and len(absent) == len(DETAIL_FIELDS):
            violations.append(f"Không tìm thấy mã địa điểm {p['place_id']} trong dữ liệu.")
        if not 0 <= start < end <= 24:
            violations.append(f"Khung giờ không hợp lệ tại {name} ({start}h–{end}h).")
        if p.get("open_hour") is not None and p.get("close_hour") is not None:
            if start < p["open_hour"] or end > p["close_hour"]:
                violations.append(f"{name} chỉ mở {p['open_hour']}h–{p['close_hour']}h (lịch {start}h–{end}h).")
        elapsed, travel = _leg(previous, p)
        if elapsed is not None:
            if elapsed < 0:
                violations.append(f"Bị chồng giờ tại {name} ({start}h).")
            elif travel is None:
                absent.append("travel_min")
            elif elapsed < travel:
                violations.append(f"Chưa đủ thời gian di chuyển tới {name} (cần {travel} phút, có {elapsed:g} phút).")
        if absent:
            missing.append({"id": p["id"], "place_id": p["place_id"], "day": p["day"], "fields": absent})
        if p.get("avg_price_vnd") is not None:
            total += p["avg_price_vnd"]
        previous = p
    if budget_per_person_vnd > 0 and total > budget_per_person_vnd:
        violations.append(f"Tổng chi phí {total:,}đ/người vượt ngân sách {budget_per_person_vnd:,}đ/người.")
    return {"valid": not violations, "total_per_person_vnd": total, "violations": violations,
            "missing_data": missing}

# OSM-PLACES-TOOL.md — Đặc tả Input & Output công cụ tìm địa điểm OSM

| | |
|---|---|
| Phiên bản | 0.1 |
| Trạng thái | Đang dùng |
| Cập nhật | 2026-11-27 |
| File code | `codebase/osm_places.py`, `codebase/tools.py` |
| Đi kèm | `docs/DATABASE.md` mục 3.1, `docs/PROJECT-RULES.md` (R-36) |

Tài liệu mô tả đầu vào (Input), đầu ra (Output), ánh xạ kiểu dữ liệu và hành vi xử lý lỗi của module tìm quán ăn, quán cafe, điểm tham quan, khách sạn từ OpenStreetMap để tích hợp với **Map** (frontend/backend) và **agent Roa**.

---

## 1. Kiến trúc gọi và cơ chế dự phòng

1. **Nguồn chính:** Gọi `OSM Overpass API` (`overpass-api.de`, dự phòng `lz4.overpass-api.de`) theo khung toạ độ `boundingbox` và khớp tag chính xác.
2. **Tự động fallback:** Nếu Overpass trả `502` / `504` hoặc quá thời gian chờ (`timeout`), hàm tự động chuyển sang `OSM Nominatim Search` có khoá cứng `viewbox` + `bounded=1` + `extratags=1` để luôn trả kết quả đúng trong khung bản đồ.
3. **Cache trong bộ nhớ:** Lưu tạm theo bộ tham số `(bbox, categories, keyword, limit)` trong `3600 giây` để giảm lặp request khi kéo bản đồ hoặc chạy agent nhiều bước.

---

## 2. Đặc tả Input

Module cung cấp **2 điểm gọi** tuỳ ngữ cảnh sử dụng:

### 2.1. Hàm gọi từ code Map / Backend: `search_places_osm(...)`

Import từ `codebase/osm_places.py`:

```python
from codebase.osm_places import search_places_osm, make_bbox_around, clear_places_cache
```

| Tham số | Kiểu | Bắt buộc? | Mặc định | Mô tả |
|---|---|---|---|---|
| `lat` | `float \| None` | Có *(nếu không truyền `bbox`)* | `None` | Vĩ độ tâm vùng tìm kiếm (ví dụ `11.9404`). |
| `lng` | `float \| None` | Có *(nếu không truyền `bbox`)* | `None` | Kinh độ tâm vùng tìm kiếm (ví dụ `108.4380`). |
| `categories` | `list[str] \| None` | Không | `None` *(lấy cả 4 loại)* | Danh sách loại địa điểm cần lọc. Chấp nhận cả tên OSM (`"restaurant"`, `"cafe"`, `"attraction"`, `"hotel"`) và tên `kind` của Plan JSON (`"food"`, `"sight"`), hoặc `["all"]`. |
| `radius_km` | `float` | Không | `2.5` | Bán kính (km) mở rộng từ `(lat, lng)` thành hình hộp khi không truyền `bbox`. |
| `bbox` | `tuple[float, float, float, float] \| None` | Có *(nếu không truyền `lat, lng`)* | `None` | Khung nhìn trực tiếp từ bản đồ theo đúng thứ tự **`(south, west, north, east)`** = `(min_lat, min_lng, max_lat, max_lng)`. Khi truyền `bbox`, `lat`/`lng`/`radius_km` sẽ được bỏ qua. |
| `keyword` | `str \| None` | Không | `None` | Từ khoá lọc thêm (không phân biệt hoa thường) trên `name` và `address`. |
| `limit` | `int` | Không | `50` | Số lượng địa điểm tối đa trả về sau khi khử trùng lặp. |
| `timeout` | `float` | Không | `6.0` | Thời gian chờ tối đa (giây) cho mỗi lượt gọi HTTP. |
| `use_cache` | `bool` | Không | `True` | `True` = dùng cache bộ nhớ 1 giờ; `False` = ép gọi mới từ OSM. |

**Hàm phụ trợ đi kèm:**
* `make_bbox_around(lat: float, lng: float, radius_km: float = 2.5) -> tuple[float, float, float, float]`: trả về `(south, west, north, east)`.
* `clear_places_cache() -> None`: xoá cache trong tiến trình hiện tại.

---

### 2.2. Công cụ gọi từ Agent Roa (`@tool`): `search_places(...)`

Import từ `codebase/tools.py` (đã đăng ký vào `TOOLS` của khung tracing):

```python
from codebase.tools import search_places
```

| Tham số | Kiểu | Bắt buộc? | Mặc định | Mô tả |
|---|---|---|---|---|
| `lat` | `float` | Có | — | Vĩ độ tâm khu vực cần tìm. |
| `lng` | `float` | Có | — | Kinh độ tâm khu vực cần tìm. |
| `category` | `str` | Không | `"all"` | Chuỗi đơn hoặc phân tách bằng dấu phẩy: `"all"`, `"cafe"`, `"restaurant"`, `"attraction"`, `"hotel"`, hoặc `"cafe,attraction"`. |
| `radius_km` | `float` | Không | `2.5` | Bán kính tìm kiếm quanh tâm (km). |
| `keyword` | `str` | Không | `""` | Từ khoá lọc theo tên hoặc đường/phường. |
| `limit` | `int` | Không | `30` | Số địa điểm tối đa trả về cho LLM. |

---

## 3. Đặc tả Output

Cả `search_places_osm(...)` và `search_places(...)` đều trả về `list[dict[str, Any]]`. Nếu không có địa điểm nào khớp vùng tìm kiếm, hàm trả về danh sách rỗng `[]`.

### 3.1. Bảng trường của mỗi phần tử địa điểm

| Trường | Kiểu dữ liệu | Có thể `null`? | Mô tả & Quy ước tích hợp |
|---|---|---|---|
| `place_id` | `str` | Không | Định danh duy nhất từ OSM theo mẫu `"osm:<type>:<id>"` (ví dụ `"osm:node:13026138101"`, `"osm:way:4829102"`). Khớp cột `place_id` trong `docs/DATABASE.md` §3.1. |
| `name` | `str` | Không | Tên hiển thị tiếng Việt (`name:vi` ưu tiên, sau đó `name`). Các điểm không có tên trên OSM đã bị loại bỏ. |
| `kind` | `str` | Không | Nhãn chuẩn hoá theo Plan JSON (`docs/DATABASE.md` §3.1): `"food"` \| `"cafe"` \| `"sight"` \| `"hotel"`. |
| `category` | `str` | Không | Nhãn gốc nhóm OSM: `"restaurant"` \| `"cafe"` \| `"attraction"` \| `"hotel"`. |
| `lat` | `float` | Không | Vĩ độ WGS84. Với `way`/`relation` trên OSM, hàm tự lấy toạ độ tâm (`center`). |
| `lng` | `float` | Không | Kinh độ WGS84 (khớp tên trường `lng` trong `docs/DATABASE.md` §3.1 và Google/Leaflet/Mapbox). |
| `lon` | `float` | Không | Bản sao của `lng` để tương thích trực tiếp với các thư viện map hoặc hàm nhận `lon`. |
| `address` | `str \| None` | **Có** | Địa chỉ ghép từ `addr:housenumber`, `addr:street`, `addr:subdistrict`/`quarter`, `addr:city` (hoặc `addr:full`). Thiếu trên OSM → trả `None` (`null`). |
| `opening_hours` | `str \| None` | **Có** | Chuỗi giờ mở cửa nguyên gốc từ OSM (ví dụ `"Mo-Su 07:00-22:00"`). **Tuân thủ R-36:** thiếu trên OSM → trả `None` (`null`, hiểu là *"chưa rõ"*), tuyệt đối không tự điền giờ giả. |
| `phone` | `str \| None` | **Có** | Số điện thoại liên hệ (`phone` hoặc `contact:phone`) nếu có. |
| `website` | `str \| None` | **Có** | Trang web / link mạng xã hội chính thức nếu có trên OSM. |
| `sources` | `list[dict]` | Không | Nguồn truy vết cho Plan JSON (R-36), luôn có dạng `[{"type": "osm", "ref": "<place_id>"}]`. |

### 3.2. Bảng ánh xạ loại địa điểm (`Input` → `category` & `kind`)

| Giá trị truyền vào `categories` / `category` | Tag truy vấn trên OSM | `category` ở Output | `kind` ở Output (`DATABASE.md`) |
|---|---|---|---|
| `"restaurant"` hoặc `"food"` | `amenity=restaurant` | `"restaurant"` | `"food"` |
| `"cafe"` | `amenity=cafe` | `"cafe"` | `"cafe"` |
| `"attraction"` hoặc `"sight"` | `tourism=attraction\|viewpoint\|museum` | `"attraction"` | `"sight"` |
| `"hotel"` | `tourism=hotel\|guest_house` | `"hotel"` | `"hotel"` |

### 3.3. JSON Output mẫu thực tế

```json
[
  {
    "place_id": "osm:node:13026138101",
    "name": "Le J' Cafe",
    "kind": "cafe",
    "category": "cafe",
    "lat": 11.9423644,
    "lng": 108.451511,
    "lon": 108.451511,
    "address": "Yersin, Phường Xuân Hương - Đà Lạt",
    "opening_hours": "Th-Tu 07:30-17:00",
    "phone": null,
    "website": null,
    "sources": [
      {
        "type": "osm",
        "ref": "osm:node:13026138101"
      }
    ]
  },
  {
    "place_id": "osm:node:4752367226",
    "name": "Backpackers tourist cafe",
    "kind": "cafe",
    "category": "cafe",
    "lat": 11.9422535,
    "lng": 108.4341671,
    "lon": 108.4341671,
    "address": "1, Ba Tháng Hai, Phường Xuân Hương - Đà Lạt, Đà Lạt",
    "opening_hours": null,
    "phone": null,
    "website": null,
    "sources": [
      {
        "type": "osm",
        "ref": "osm:node:4752367226"
      }
    ]
  }
]
```

---

## 4. Hành vi biên và ngoại lệ cần biết khi ghép với Map

| Tình huống | Hành vi của hàm |
|---|---|
| Không truyền `bbox` và thiếu `lat` hoặc `lng` | Ném `ValueError("Cần truyền (lat, lng) hoặc bbox=(south, west, north, east).")` |
| Truyền `bbox` không đủ 4 phần tử | Ném `ValueError("bbox phải gồm 4 giá trị (south, west, north, east).")` |
| Không có quán nào trong vùng bản đồ / từ khoá | Trả về `[]` (không ném lỗi) |
| Trùng địa điểm trên OSM (cùng tên & toạ độ làm tròn `1e-4` độ ~11m) | Tự động gộp, chỉ giữ bản ghi đầu tiên |
| Cả Overpass lẫn Nominatim đều mất mạng / bị chặn | Ném ngoại lệ mạng gốc (`urllib.error.URLError` / `HTTPError` / `TimeoutError`) để tầng service/API bắt và trả mã lỗi phù hợp |

---

## 5. Ví dụ tích hợp nhanh

```python
from codebase.osm_places import search_places_osm

# 1. Lấy marker theo khung nhìn hiện tại của bản đồ (south, west, north, east)
bounds = (11.9250, 108.4250, 11.9550, 108.4600)
markers = search_places_osm(
    bbox=bounds,
    categories=["food", "cafe", "sight"],
    limit=40,
)

for m in markers:
    hours_label = m["opening_hours"] or "Chưa rõ giờ mở cửa"
    print(f"[{m['kind']}] {m['name']} ({m['lat']}, {m['lng']}) - {hours_label}")
```

---

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung |
|---|---|---|---|
| 0.1 | 2026-11-27 | Nhóm Spiritup | Bản đầu: đặc tả Input/Output cho `search_places_osm` và `@tool search_places` |

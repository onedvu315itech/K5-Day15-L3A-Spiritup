# Luồng và kiến trúc agent Roa — bản đang chạy

| | |
|---|---|
| Phiên bản | 0.1 |
| Trạng thái | Nháp, mô tả code trên nhánh `feat/kho-du-lieu-va-agent-roa` |
| Người phụ trách | Khương (agent, dữ liệu đầu ra) |
| Cập nhật | 2026-11-28 |
| Đi kèm | `ARCHITECTURE.md` §3.3, §7 · `docs/roa-agent-design.md` (thiết kế, phương án) · `spec.md` §4 · `data/DATA_CARD.md` Dataset 2 |

File này mô tả **Roa đang chạy thế nào trong code**: thành phần, luồng `generate`, ai gọi ai, số nào do code tính. Vì sao chọn cách này và các phương án còn bàn ở `docs/roa-agent-design.md`. Code là nguồn đúng; đổi code thì sửa file này trong cùng PR.

## 1. Kiến trúc theo lớp

```mermaid
flowchart TB
  subgraph Batch["Chạy tay, theo đợt (scripts/, không chạy lúc Roa trả lời)"]
    GEO["spike_geoapify.py<br/>tải danh mục OSM qua Geoapify"]
    RAW[("data/raw/*.json<br/>bản tải thô — KHÔNG commit")]
    BUILD["build_place_store.py<br/>lọc, chuẩn hoá, gộp bộ mẫu CP2"]
    TT["spike_tiktok_trending.py<br/>quán hot (chưa đưa vào kho)"]
    GEO --> RAW --> BUILD
    TT -.-> RAW
  end
  STORE[("data/places/&lt;thanh-pho&gt;.json<br/>kho địa điểm — commit")]
  BUILD --> STORE

  subgraph Core["codebase/ — lõi Roa"]
    AG["agent.py<br/>answer(text) → luồng generate"]
    TL["tools.py<br/>5 công cụ @tool, chỉ đọc"]
    AI["ai.py<br/>call_model() @model_call"]
    TR["tracing.py (khung BTC)<br/>ghi trace, đếm token"]
  end
  STORE --> TL
  AG --> TL
  AG --> AI
  AI --> LLM["LLM — chưa chốt (OQ-01)<br/>hiện chạy model giả"]
  TL -. ghi trace .-> TR
  AI -. ghi trace .-> TR

  RUN["run.py / eval/run_eval.py<br/>bộ câu thử, mô phỏng chi phí"] --> AG
  BE["backend/ (sau CP3)<br/>plan_service gọi generate"] -.-> AG
```

| Lớp | File | Việc | Không được làm |
|---|---|---|---|
| Thu dữ liệu | `scripts/spike_geoapify.py`, `scripts/build_place_store.py` | Tải danh mục OSM, lọc nơi đọc được giờ, gộp bộ mẫu CP2, ghi kho | Không chạy lúc Roa trả lời; không đoán giá |
| Kho | `data/places/<slug>.json` | Nguồn duy nhất cho công cụ | Không chứa dữ liệu cá nhân; giữ ghi công OSM (`attribution`) |
| Công cụ | `codebase/tools.py` | Đọc kho, tính giờ, thời gian đi, tổng tiền, kiểm lịch | Không gọi mạng, không ghi gì |
| Agent | `codebase/agent.py` | Điều phối các bước, mẫu câu trả lời, in kết quả | Không ghi plan (R-31); không để model tính số |
| Model | `codebase/ai.py` | Chỗ duy nhất gọi LLM | Không sửa hợp đồng 4 khoá |
| Khung BTC | `codebase/tracing.py`, `run.py`, `eval/run_eval.py` | Trace, chạy câu thử | Không sửa |

## 2. Luồng `generate` (B1–B10)

`answer(text)` nhận một câu yêu cầu tiếng Việt và trả `{"output": str}`. Mỗi nhánh dừng sớm trả lời bằng **mẫu do code viết**, không qua model.

```mermaid
flowchart TD
  IN(["answer(text)"]) --> R{"B2 · Có ý từ chối?<br/>đặt bàn, lưu thẳng v2,<br/>prompt hệ thống, API key"}
  R -- có --> OUT_R["Mẫu từ chối<br/>+ nhắc phạm vi"]
  R -- không --> P["B1 · Tách yêu cầu<br/>regex + model (JSON)"]
  P --> C{"Thành phố có kho?"}
  C -- không --> OUT_N["Mẫu chưa có dữ liệu<br/>khung [Cần kiểm tra & điền tay]"]
  C -- có --> M{"Thiếu ngày / người / ngân sách?"}
  M -- thiếu --> OUT_Q["Mẫu hỏi lại<br/>đúng mục thiếu"]
  M -- đủ --> B{"Nhiều mức ngân sách?"}
  B -- có --> OUT_B["Mẫu mâu thuẫn ngân sách<br/>3 phương án, hỏi nhóm trưởng"]
  B -- không --> CA["B3 · Ứng viên c1..cK<br/>search_places, get_trending_spots<br/>lọc chay, chỉ nơi có giá nếu có ngân sách"]
  CA --> F1{"B4 · Chi phí tối thiểu<br/>&gt; ngân sách?"}
  F1 -- có --> OUT_F["Mẫu không xếp được<br/>nêu số và lý do"]
  F1 -- không --> F2{"B4 · Điểm bắt buộc<br/>vừa khung giờ?"}
  F2 -- không --> OUT_M["Mẫu không xếp được<br/>giờ mở cửa, thời gian đi<br/>+ phương án thu hẹp"]
  F2 -- có --> D["B5 · Code dựng bản nháp<br/>tìm theo khung giờ trong ngày"]
  D --> S["B6 · Model chọn lại theo mã<br/>(JSON items + reasons)"]
  S --> K{"B8 · check_itinerary<br/>hợp lệ?"}
  K -- không, còn lượt --> FIX["B9 · Model sửa một lần<br/>kèm danh sách vi phạm"]
  FIX --> K2{"hợp lệ?"}
  K2 -- không --> KEEP["Giữ bản nháp của code"]
  K -- có --> REN
  K2 -- có --> REN
  KEEP --> REN["B10 · Code in lịch<br/>giờ, tiền, thời gian đi, cảnh báo"]
  REN --> OUT(["{'output': ...}"])
```

### Từng bước

| Bước | Hàm trong `agent.py` | Ai làm | Ghi chú |
|---|---|---|---|
| B2 từ chối | `refusal` | Code (regex) | Chạy **trước** khi gọi model, nên câu tấn công không vào prompt |
| B1 tách | `parse_regex`, `parse` | Regex trước, model lấp chỗ trống | Số (ngày, người, tiền, giờ) ưu tiên regex vì đọc thẳng từ câu. Điểm bắt buộc: tên đủ hoặc phần đầu ≥ 3 từ khớp tên trong kho. Không nêu thành phố thì suy ra từ tên điểm |
| B2 chưa có dữ liệu | `no_data` | Code | `search_places` rỗng → khung trống theo ngày (OQ-22 phương án a) |
| B2 hỏi lại | `missing_info` | Code | Hỏi khi thiếu điểm đến, số ngày (hoặc khung giờ) hay số người; thiếu riêng ngân sách thì vẫn xếp, không kiểm tiền |
| B2 mâu thuẫn | `budget_conflict` | Code | Từ hai mức `…đ/người` trở lên |
| B3 ứng viên | `candidates` | Code + công cụ | Tối đa `MAX_CANDIDATES = 25`, xếp: bắt buộc → hot → có giá → rẻ |
| B4 chi phí | `min_cost` | Code | Tổng các bữa rẻ nhất ở các quán khác nhau + 1 cafe rẻ nhất; số bữa theo câu ("4 bữa") hoặc theo khung giờ |
| B4 giờ | `must_visit_check`, `fit_sequence` | Code | Thử mọi thứ tự các điểm bắt buộc (≤ 4! cách); không cách nào vừa thì tìm tập con lớn nhất làm phương án thu hẹp |
| B5 bản nháp | `draft`, `day_slots`, `plan_day` | Code | Tìm theo chiều sâu trên các khung trong ngày (mục 3); chia ngân sách còn lại cho các ngày còn lại |
| B6 chọn | `select` | Model | Chỉ nhận mã `c1..cK`; trả sai mẫu thì giữ bản nháp |
| B8 kiểm | `check` → `check_itinerary` | Công cụ | Giờ mở cửa, chồng giờ, đủ thời gian đi, khung giờ, ngân sách |
| B9 sửa | trong `select` | Model, 1 lần | Vẫn sai, hoặc làm rơi điểm bắt buộc → giữ bản nháp |
| B10 in | `render`, `infeasible_*` | Code | Tổng tiền chỉ cộng mục có giá; nơi thuộc bộ mẫu CP2 ghi "chưa xác minh" |

Số lần gọi model mỗi câu: 0 (từ chối), 1 (dừng sau B1), 2 (bình thường), 3 (có sửa). Giới hạn `MAX_STEPS = 5`.

### Ai gọi ai trong một câu bình thường

```mermaid
sequenceDiagram
  autonumber
  participant E as run.py / backend
  participant A as agent.py
  participant M as ai.call_model
  participant T as tools.py
  E->>A: answer("Nhóm 6 người đi Đà Lạt 1 ngày, 400.000đ/người…")
  A->>A: refusal() — không khớp
  A->>M: PARSE_PROMPT + câu
  M-->>A: JSON (hoặc chữ hỏng → dùng regex)
  A->>T: search_places(city) · get_trending_spots(city)
  T-->>A: ứng viên (giờ, giá, khu, hot)
  A->>A: min_cost · must_visit_check · draft()
  A->>T: get_opening_hours(ids)
  A->>M: bảng ứng viên + bản nháp → chọn
  M-->>A: {"items": [...], "reasons": "..."}
  A->>T: check_itinerary(items, budget, window)
  T-->>A: valid, total, violations, warnings
  opt có vi phạm
    A->>M: sửa kèm violations
    M-->>A: items mới
    A->>T: check_itinerary(...)
  end
  A-->>E: {"output": lịch trình do code in}
```

## 3. Bản nháp bằng code (B5)

Mỗi ngày chia thành các khung. Mỗi khung chọn một nơi hợp loại hoặc bỏ trống:

| Khung | Bắt đầu sớm nhất – muộn nhất | Loại | Thời lượng |
|---|---|---|---|
| Sáng sớm (chỉ ngày 1, khi câu có "từ HH:MM") | 05:00–06:30 | tham quan | 120 phút |
| Bữa sáng / cafe sáng | 07:00–09:00 | ăn, cafe | 60 |
| Tham quan sáng | 09:00–10:30 | tham quan | 90 |
| Bữa trưa | 11:00–13:00 | ăn | 75 |
| Cafe chiều | 13:30–15:30 | cafe | 60 |
| Tham quan chiều | 14:30–16:30 | tham quan | 90 |
| Bữa tối | 17:30–19:30 | ăn | 75 |
| Cafe tối | 19:15–21:00 | cafe | 60 |

- Khung ngoài khung giờ nhóm nêu ("từ 18:00 đến 21:30") bị bỏ.
- Giờ bắt đầu thực = muộn nhất trong: đầu khung, giờ mở cửa, giờ xong điểm trước + thời gian đi. Phải xong trước giờ đóng cửa và cuối khung giờ nhóm nêu.
- Điểm số chọn bản tốt nhất: điểm bắt buộc +100 · mỗi mục +10 · lấp bữa trưa hoặc sáng sớm +5 · điểm bắt buộc ở khung sáng sớm +20 · quán hot +3 · rẻ hơn thắng khi hoà.
- Mỗi nơi chỉ dùng một lần trong cả chuyến.

## 4. Công cụ (`codebase/tools.py`)

| Công cụ | Input | Output | Tác động ra ngoài |
|---|---|---|---|
| `search_places` | `city`, `preference` ("chay"), `category` | danh sách `{id, name, category, area, open, close, avg_price_vnd, vegetarian_friendly, is_hot, source}`; rỗng nếu thành phố chưa có kho | Không |
| `get_trending_spots` | `city` | nơi có `is_hot` | Không |
| `get_opening_hours` | `place_ids` | `{id: {name, open, close}}` | Không |
| `get_travel_time` | mã A, mã B | số phút xe máy | Không (ước tính bằng code, không gọi dịch vụ chỉ đường) |
| `check_itinerary` | `items [{day, id, start, end}]`, `budget_per_person_vnd`, `window_start`, `window_end` | `{valid, total_per_person_vnd, unpriced, violations, warnings}` | Không |

**Thời gian đi** (`_travel`):
- Hai nơi cùng có toạ độ: đường chim bay × 1,7 ÷ 25 km/h + 5 phút gửi xe, tối thiểu 10 phút *(tự ước tính; hệ số 1,7 đo trên 2 chặng ở `docs/roa-agent-design.md` §2.1)*.
- Thiếu toạ độ (bộ mẫu CP2): theo khu. Cầu Đất 45 phút, Trại Mát 25, cùng khu 10, còn lại 15 (số nhóm đặt ở CP2).

**Vi phạm cứng** (làm `valid = false`): ngoài giờ mở cửa · giờ kết thúc không sau giờ bắt đầu · chồng giờ · không đủ thời gian đi · ngoài khung giờ nhóm nêu · tổng tiền vượt ngân sách · mã không có trong kho.
**Cảnh báo** (vẫn hợp lệ): nơi chưa có giá (không cộng vào tổng) · nơi thuộc bộ mẫu CP2.

## 5. Kho địa điểm (`data/places/<slug>.json`)

```json
{
  "city": "Đà Lạt", "built_at": "2026-11-28",
  "attribution": "Dữ liệu địa điểm © OpenStreetMap contributors (ODbL). Powered by Geoapify.",
  "places": [
    {"id": "osm:…", "name": "…", "city": "Đà Lạt", "category": "cafe|food|sightseeing",
     "area": "Phường …|null", "open_min": 420, "close_min": 1320, "opening_hours_raw": "07:00-22:00",
     "avg_price_vnd": null, "vegetarian_friendly": true|null, "is_hot": false,
     "lat": 11.94, "lon": 108.44, "address": "…", "website": "…",
     "source": "osm_geoapify|mau_cp2", "source_note": "…", "fetched_at": "2026-11-27"}
  ]
}
```

- Tên file là `slug(city)`: "Đà Lạt" → `da-lat.json`. Thêm thành phố = chạy lại `build_place_store.py` với `--city`, không sửa code.
- Giờ tính theo phút từ 0h; đóng qua nửa đêm thì `close_min > 1440`.
- Hiện có 94 nơi Đà Lạt (8 `mau_cp2`, 86 `osm_geoapify`). Chi tiết ở `data/DATA_CARD.md` Dataset 2.

## 6. Nhánh trả lời ↔ bộ câu thử

| Nhánh | Câu thử | Kết quả chạy bằng model giả (28/11) |
|---|---|---|
| Lịch hợp lệ | B01–B05 | Ra lịch, trong ngân sách và giờ mở cửa |
| Hỏi lại | B06 | Hỏi số ngày, số người, ngân sách |
| Không xếp được, ngân sách | B07 | Tối thiểu 550.000đ/người > 100.000đ |
| Chưa có dữ liệu | B08 | Khung `[Cần kiểm tra & điền tay]` |
| Mâu thuẫn ngân sách | B09 | 3 phương án, hỏi nhóm trưởng |
| Không xếp được, giờ | B10 | Lý do giờ mở cửa và thời gian đi, giữ 2 điểm |
| Từ chối | B11, B12 | Mẫu từ chối |

Kết quả trên chưa chấm cột `pass` và chưa có lượt model thật.

## 7. Giới hạn đã biết và việc tiếp

| Giới hạn | Ảnh hưởng | Hướng xử lý | Ai |
|---|---|---|---|
| Chưa nối model thật (OQ-01) | B1 và B6 đang chạy dự phòng; chưa có `eval/run-1.csv` hợp lệ | Chốt OQ-01, viết `ai.py` | Toàn, Đức |
| 86 nơi OSM chưa có giá | Câu có ngân sách gần như chỉ dùng 8 nơi mẫu | Tra giá theo đợt bằng Tavily (`docs/roa-agent-design.md` §3.1) | Khương, sau CP3 |
| Độ hot chỉ có ở bộ mẫu | "Quán hot" chưa phản ánh dữ liệu thật | Đưa kết quả `spike_tiktok_trending.py` vào kho | Khương |
| Chưa hiểu "trong thành phố" / "ngoại ô" | B02 có thể xếp Cầu Đất cho buổi chiều | Thêm cờ khu ngoại ô trong kho và lọc ở B3 | Khương |
| Thời lượng, khung giờ, tốc độ xe tự đặt | Lịch có thể quá dày hoặc thưa | Hỏi người dùng thật, chỉnh số trong `agent.py` | Nhóm |
| Từ chối bằng regex | Câu tấn công diễn đạt khác có thể lọt | Model vẫn bị chặn bởi quy tắc trong `SYSTEM` và chỉ được trả mã ứng viên | Theo dõi qua eval |

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung |
|---|---|---|---|
| 0.1 | 2026-11-28 | Khương | Bản đầu: kiến trúc lớp, luồng B1–B10, khung giờ, công cụ, kho, đối chiếu câu thử |

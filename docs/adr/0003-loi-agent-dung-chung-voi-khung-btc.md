# ADR 0003 — Lõi agent Roa dùng chung với khung BTC

| | |
|---|---|
| Trạng thái | Đề xuất |
| Ngày | 2026-11-27 |
| Người quyết | Toàn + Khương, Đức duyệt (OQ-08) |
| Thay thế | — |

## Bối cảnh

BTC chấm agent bằng khung trong repo: `run.py eval` gọi `codebase/agent.py` `answer(text)`, đo qua `@model_call` và `@tool` trong `codebase/tracing.py`; `cost/simulate.py` ước chi phí từ trace. Web app cũng cần agent đó. Nếu backend có bản agent riêng, eval đo một thứ còn web chạy thứ khác, và nhóm phải giữ hai bản prompt, công cụ.

## Quyết định (đề xuất)

- Lõi Roa (prompt, vòng gọi công cụ, ba chế độ `generate` / `draft` / `ask`) đặt trong `codebase/`:
  - `codebase/ai.py` — `call_model()` duy nhất (R-30).
  - `codebase/tools.py` — các `@tool`: `search_places`, `get_place_details`, `get_travel_time`, `get_trending_spots`, `check_plan`.
  - `codebase/agent.py` — `answer(text)` giữ đúng hợp đồng BTC, gọi lõi ở chế độ `generate` (lát cắt nộp BTC, OQ-19): nhận yêu cầu chuyến đi, trả lịch trình theo ngày hoặc lý do không xếp được; thêm các hàm `generate_plan(trip)`, `draft_ops(plan, request)`, `ask(plan, question)` cho backend.
- Backend import `codebase` qua `agent_service`; không có bản agent thứ hai.
- Công cụ đọc Google qua một lớp có cache; khi chạy eval không có DB thì dùng cache file hoặc dữ liệu mẫu trong `data/`.

## Phương án đã cân nhắc

| Phương án | Được | Mất |
|---|---|---|
| **Lõi ở `codebase/`, backend import** | Eval đo đúng thứ web chạy; một bản prompt | Backend phụ thuộc cấu trúc khung BTC; deploy Render phải gồm `codebase/` |
| Lõi ở `backend/`, `codebase/agent.py` gọi HTTP sang backend | Backend gọn | Eval cần backend đang chạy; trace `@tool` không ghi được trong tiến trình eval |
| Hai bản riêng | Độc lập | Lệch nhau, gấp đôi việc |

## Hệ quả

- Render build từ gốc repo, nơi có cả `backend/` và `codebase/` (OQ-07 đã chốt: nội dung `starter-repo/` đưa ra gốc).
- `requirements.txt` của khung BTC và `backend/requirements.txt` phải tương thích.
- Đổi prompt hay công cụ phải chạy lại eval (R-37).
- Không được sửa `codebase/tracing.py` (R-62).

# Báo cáo đánh giá — lượt 1 → một cải tiến → lượt 2

> Điền ở guide bước 4.1. Lượt 1 trước **CP3 10:00 Thứ Bảy 28/11**, lượt 2 trước **CP4 14:30 Thứ Bảy 28/11**, cùng bộ câu thử, cùng cách chấm. Chấm ở rubric R5.
> Số lấy từ `python run.py score eval/run-1.csv` (và `run-2.csv`) sau khi điền cột `pass`. **Kết quả thấp ghi thật vẫn đủ điểm.**
> Không được: sửa chuẩn "đạt", bỏ câu thử trượt, sửa `expected` cho khớp output, sửa kết quả lượt đã chạy.

## 1. Kết quả

| Lượt | Run ID | Đạt / tổng | % | thuong | kho | tu_choi | So với chuẩn "đạt" |
|---|---|---|---|---|---|---|---|
| 1 | `run-1@20261128-033425` (`gemini-3.5-flash`) | `4/24` | `17%` | `3/11` (`27%`) | `0/9` (`0%`) | `1/4` (`25%`) | chưa *(20/24 câu lỗi `HTTP 429`)* |
| 2 | `run-2@20261128-034607` (`openai/gpt-4o-mini`) | `11/24` | `46%` | `1/11` (`9%`) | `6/9` (`67%`) | `4/4` (`100%`) | chưa *(8 câu lỗi JSON thô)* |
| 3 *(sau sửa JSON mode)* | `run-3@20261128-035701` (`openai/gpt-4o-mini`) | `2/24` | `8%` | `1/11` (`9%`) | `0/9` (`0%`) | `1/4` (`25%`) | chưa *(21/24 câu lỗi `HTTP 402` hết credit OpenRouter)* |

Kết quả từng câu: `eval/run-1.csv`, `eval/run-2.csv`, `eval/run-3.csv`. Trace: `traces/run-1.jsonl`, `traces/run-2.jsonl`, `traces/run-3.jsonl`.

## 2. Lỗi lượt 2 (`run-2@20261128-034607`, đủ 24/24 câu không lỗi API) — gom thành nhóm có tên

| Nhóm lỗi | Số câu | Câu |
|---|---|---|
| JSON điều phối bị thừa dấu `}` khi gọi `get_travel_time`, làm `agent.py` trả JSON thô | 8 | `B01`, `B02`, `B03`, `B04`, `B05`, `B13`, `B14`, `B22` |
| `fill_gaps` đặt `start_hour` trùng `end_hour` mục trước (0 phút đệm di chuyển) | 2 | `B17`, `B18` |
| Thiếu nhãn `[Cần kiểm tra & điền tay]` / nhồi quá ngân sách / hứa tìm loại ngoài kho | 3 | `B16`, `B19`, `B20` |

**≥3 lỗi cụ thể từ `eval/run-2.csv`:**

| Câu | Input | Output | Vì sao sai |
|---|---|---|---|
| `B01` | Nhóm 6 người đi Đà Lạt 1 ngày, ngân sách 400.000đ/người, ưu tiên quán hot | `{"action": "call_tools", ..., "destination": {"lat": 11.9493, "lon": 108.4485}}}}]}` | Model xuất thừa 1 dấu `}` ở cuối `get_travel_time`; `_extract_json` trả `None` khiến `agent.py` tưởng văn bản thường và trả nguyên JSON thô |
| `B17` | Plan gốc Hà Nội `HN-01` (08:00–09:00), `HN-06` (10:30–12:00), gợi ý lấp khoảng trống | `09:00–10:30: Cà Phê Giảng (cần 1 phút di chuyển, nhưng không đủ thời gian di chuyển)` | Đặt mục mới bắt đầu ngay `09:00` (0 phút đệm sau `HN-01` kết thúc `09:00`) nên `check_itinerary` báo thiếu 1 phút di chuyển |
| `B20` | Tìm giúp homestay giá rẻ có ảnh phòng và đặt cọc cho 6 người | `Xin lỗi, nhưng tôi không thể đặt bàn, giữ phòng... Bạn có muốn tôi tìm kiếm không?` | Từ chối đặt phòng đúng nhưng lại hỏi tìm kiếm homestay thay vì báo rõ công cụ không có dữ liệu chỗ ở và gắn `[Cần kiểm tra & điền tay]` |

## 3. Một lần cải tiến

- Nhắm vào nhóm lỗi: **JSON điều phối bị lỗi cú pháp & 0 phút đệm di chuyển ở `fill_gaps`** — vì sao là nhóm **đau nhất với người dùng**: người dùng nhận thẳng JSON thô trên 8/24 câu (33% bộ câu thử) và luồng lấp khoảng trống luôn báo bất khả thi vì lệch 1–6 phút di chuyển.
- Đã sửa gì: (1) bật `response_format: {"type": "json_object"}` cho `openrouter` và `responseMimeType: "application/json"` cho `gemini` trong `codebase/ai.py`; (2) thêm cơ chế phát hiện và yêu cầu model xuất lại khi JSON `"action"` bị lỗi cú pháp trong `codebase/agent.py` (kèm test trong `tests/test_agent.py`); (3) bổ sung công thức cộng/trừ đệm di chuyển `max(travel_min, 15)/60` cho `fill_gaps` và nhắc rõ không hứa tìm loại ngoài kho (homestay/khách sạn).
- Kết quả sau sửa ở `run-3`: không còn câu nào trả JSON thô (`B02` từ JSON thô thành **đạt** với đủ 3 khung sáng/trưa/chiều, `300.000đ ≤ 350.000đ`; `B12` **đạt**). Tuy nhiên `B03`–`B11` và `B13`–`B24` (21 câu) bị lỗi `HTTP 402` hết credit OpenRouter nên chưa đo được trọn bộ 24 câu sau cải tiến.
- Câu nào **tệ đi** sau khi sửa: `B01` ở `run-3` hết bị lỗi JSON thô nhưng lại hỏi ngược ngân sách dù input đã nêu `400.000đ/người` (cần nhắc rõ không hỏi lại thông tin đã có trong prompt người dùng).

## 4. Còn lại

- Lỗi chưa sửa + nguy hiểm thế nào: Cần nạp thêm credit OpenRouter (hoặc đổi key/model còn quota) để chạy lại đủ 24 câu sau cải tiến và giữ đúng `B01` không hỏi lại ngân sách đã cung cấp; cũng cần chạy lại `python run.py simulate` (≥50 phiên) sau khi có lượt eval hoàn chỉnh cùng model.
- Nếu có thêm 1 tuần: Chạy đủ 24 câu không lỗi API trên `openai/gpt-4o-mini` hoặc `gemini-3-flash-preview`, chấm chéo 2 người theo `eval/metric_spec.yaml`, và hoàn tất `cost/cost-estimate.md`.

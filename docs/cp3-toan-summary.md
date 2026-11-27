# Tổng hợp phần việc CP3 — Toàn (Agent Roa & Eval)

**Nhánh:** `docs/cp2-benchmark-datacard` · **Ngày:** 2026-11-28

## 1. Những gì đã hoàn thành

1. **Nối model thật trong `codebase/ai.py`:**
   - Giữ nguyên `load_env`, `@model_call`, nhánh `fake` và hợp đồng trả về `{"text", "model", "tokens_in", "tokens_out"}`.
   - Bổ sung `MODEL_PROVIDER == "gemini"` (Gemini REST API, tính `tokens_out = candidatesTokenCount + thoughtsTokenCount`, bật `responseMimeType: "application/json"`).
   - Bổ sung `MODEL_PROVIDER == "openrouter"` (OpenRouter Chat Completions API, bật `response_format: {"type": "json_object"}`).

2. **Nâng cấp lõi Roa trong `codebase/agent.py` (dùng đủ 8 công cụ):**
   - Hỗ trợ mọi thành phố Việt Nam (bỏ hardcode Đà Lạt) và cả 2 luồng: lập lịch mới (`generate`) và gợi ý lấp khoảng trống plan gốc (`fill_gaps` dùng `analyze_plan_gaps` + `search_nearby`).
   - Vòng lặp điều phối tối đa `MAX_STEPS = 5`, ghi `note(...)` mỗi bước; bắt buộc `check_itinerary` bằng code Python (chặn kết thúc nếu chưa kiểm lại sau `valid=False`), tự yêu cầu model xuất lại nếu JSON `"action"` bị lỗi cú pháp, và bổ sung hướng dẫn đệm di chuyển `fill_gaps`.
   - Xử lý đủ 4 lớp chỗ khó: thiếu thông tin bắt buộc → hỏi lại; thiếu dữ liệu công cụ / loại ngoài kho → `"Không biết / Chưa có dữ liệu từ công cụ"` + `[Cần kiểm tra & điền tay]`; bất khả thi → nêu rõ lý do; ngoài phạm vi / prompt injection → từ chối lịch sự.

3. **Kiểm thử đơn vị (`tests/test_tools.py`, `tests/test_agent.py`):**
   - `python -m unittest discover -s tests -v`: **16/16 test đạt (`OK`)** (12 test công cụ + 4 test cho `agent.py`/`ai.py`).

4. **Mở rộng bộ câu thử (`eval/benchmark.csv`) & `data/DATA_CARD.md`:**
   - Mở rộng từ `12` câu → **24 câu** (`thuong 11 · kho 9 · tu_choi 4`), giữ nguyên 12 câu CP2 (`B01`–`B12`).
   - Nguồn thật: **12/24 (50,0%)** (`11` từ phiếu khảo sát `evidence/survey/results.csv`, `1` từ `data/trending_spots.json` + `data/places_vn.json`).
   - `python run.py check`: **không thấy vấn đề**.

5. **Kết quả các lượt Eval & Mô phỏng chi phí:**
   - **Lượt 1 (`eval/run-1.csv`, `gemini-3.5-flash`):** `4/24 (17%)` — `4/4` câu không lỗi đều đạt, `20/24` câu lỗi `HTTP 429` (quota free tier).
   - **Lượt 2 (`eval/run-2.csv`, `openai/gpt-4o-mini`):** chạy đủ **24/24 câu không lỗi API**, đạt **`11/24 (46%)`** (`thuong 1/11`, `kho 6/9`, `tu_choi 4/4 = 100%`). Từ `run-2` phát hiện lỗi JSON thừa dấu `}` ở 8 câu và lỗi 0 phút đệm di chuyển ở `B17`, `B18`.
   - **Mô phỏng chi phí (`cost/simulate-try.csv`, `cost/simulate-try-summary.md`, `openai/gpt-4o-mini`):** `simulate --try --wait 2` chạy thành công **10/10 phiên (`0/10` lỗi)**: `dung_it` 5.791 in / 300 out (`$0.0046`/phiên theo bảng giá `gemini-3.1-flash-lite` hoặc `$0.0266`/phiên theo `gemini-4-hydrogen`).
   - **Lượt 3 (`eval/run-3.csv`, `openai/gpt-4o-mini` sau vá JSON mode & đệm di chuyển):** hết lỗi JSON thô (`B02` và `B12` đạt `2/24`), nhưng 21 câu còn lại gặp `HTTP 402` (`in_flight_budget_exhausted` — hết credit OpenRouter).

## 2. Việc cần làm tiếp trước CP4

- Nạp thêm credit OpenRouter (hoặc đổi key còn credit/quota) rồi chạy lại `python run.py eval --wait 2` (sẽ tạo `eval/run-4.csv` với toàn bộ bản vá JSON mode + `fill_gaps` đã áp dụng) và `python run.py simulate --rate-from eval/run-4.csv` (≥50 phiên) cho CP4.

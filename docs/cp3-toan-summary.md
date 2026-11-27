# Tổng hợp phần việc CP3 — Toàn (Agent Roa & Eval)

**Nhánh:** `docs/cp2-benchmark-datacard` · **Ngày:** 2026-11-28

## 1. Những gì đã hoàn thành

1. **Nối model thật trong `codebase/ai.py`:**
   - Giữ nguyên `load_env`, `@model_call`, nhánh `fake` và hợp đồng trả về `{"text", "model", "tokens_in", "tokens_out"}`.
   - Bổ sung nhánh `MODEL_PROVIDER == "gemini"` (gọi REST API `generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent`, tính `tokens_out = candidatesTokenCount + thoughtsTokenCount`).
   - Bổ sung nhánh `MODEL_PROVIDER == "openrouter"` (gọi `https://openrouter.ai/api/v1/chat/completions`) để dự phòng khi Gemini free tier bị giới hạn `HTTP 429`.

2. **Nâng cấp lõi Roa trong `codebase/agent.py` (dùng đủ 8 công cụ):**
   - Bỏ hardcode Đà Lạt, hỗ trợ mọi thành phố Việt Nam và cả 2 luồng: lập lịch mới (`generate`) và gợi ý lấp khoảng trống trên plan gốc (`fill_gaps` với `analyze_plan_gaps` + `search_nearby`).
   - Vòng lặp điều phối tối đa `MAX_STEPS = 5`, ghi `note(...)` ở mỗi bước.
   - Bắt buộc kiểm tra `check_itinerary` bằng code Python; chặn trường hợp model tự sửa/bớt mục sau khi `check_itinerary` trả `valid=False` mà không kiểm lại.
   - Xử lý đủ 4 lớp chỗ khó: thiếu thông tin bắt buộc → hỏi lại; thiếu dữ liệu công cụ → báo rõ + `[Cần kiểm tra & điền tay]`; bất khả thi → nêu rõ lý do; ngoài phạm vi / prompt injection → từ chối lịch sự.

3. **Kiểm thử đơn vị (`tests/test_tools.py`, `tests/test_agent.py`):**
   - `python -m unittest discover -s tests -v`: **15/15 test đạt (`OK`)**, gồm 12 test công cụ và 3 test cho `agent.py` / `ai.py` (lấp khoảng trống plan gốc, tính thinking tokens, chặn trả `final` khi `check_itinerary` chưa kiểm lại sau `valid=False`).

4. **Mở rộng bộ câu thử (`eval/benchmark.csv`) & `data/DATA_CARD.md`:**
   - Mở rộng từ `12` câu lên **24 câu** (`thuong 11 · kho 9 · tu_choi 4`), giữ nguyên 12 câu CP2 (`B01`–`B12`).
   - Tỷ lệ nguồn thật: **12/24 (50,0%)** (`11` câu từ phiếu khảo sát thật `evidence/survey/results.csv`, `1` câu từ `data/trending_spots.json` + `data/places_vn.json`).
   - `python run.py check`: **không thấy vấn đề**.

5. **Chạy Eval Lượt 1 (`eval/run-1.csv`, `traces/run-1.jsonl`) & Cập nhật báo cáo:**
   - Run ID: `run-1@20261128-033425` (`gemini-3.5-flash`).
   - `B01`, `B02`, `B03`, `B11` chạy xong và **đều đạt (4/4)**; `20` câu còn lại (`B04`–`B10`, `B12`–`B24`) bị lỗi kỹ thuật `HTTP 429` (vượt quota gói miễn phí Gemini).
   - `python run.py score eval/run-1.csv`: **4/24 đạt (17%)** (`thuong 3/11`, `kho 0/9`, `tu_choi 1/4`).
   - Đã cập nhật `eval/report.md`, `eval/README.md`, `spec.md` §7 & §10, `CP3-CHECKLIST.md`, `WORKLOG.md`, `docs/ai-usage.md`.

## 2. Việc còn lại / Bước tiếp theo với OpenRouter

- Vì key Gemini gói miễn phí hết quota (`HTTP 429`) nên `simulate --try` cũng ghi `cost/simulate-error.csv`.
- Để chạy lại **Eval Lượt 2** và **`simulate --try` / `simulate`** bằng OpenRouter:
  1. Đổi `.env` (không commit `.env`):
     ```env
     MODEL_PROVIDER=openrouter
     MODEL_NAME=<mã model trên OpenRouter, vd: google/gemini-2.5-flash hoặc openai/gpt-4o-mini>
     API_KEY=<OpenRouter API key>
     ```
  2. Chạy:
     ```powershell
     python run.py eval --wait 2
     python run.py simulate --try
     ```

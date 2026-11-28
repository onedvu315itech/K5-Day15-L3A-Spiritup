# WORKLOG

Nhật ký việc của nhóm. Mỗi việc xong (hoặc dừng) một dòng, ghi ngay khi xong. Ngày mới nhất ở trên.

- **Trạng thái:** ✅ xong · 🔄 đang làm · ⏸ tạm dừng / bị chặn (ghi lý do ở Output) · ❌ bỏ
- **Output:** file, PR, link deploy, kết quả lệnh
- **Thời gian:** thời gian làm thật; ước lượng thì thêm `~` (ví dụ `~1h`)
- Việc do coding agent làm vẫn ghi tên người giao việc.

## 2026-11-28

| Thành viên | Việc | Trạng thái | Output | Thời gian |
|---|---|---|---|---|
| Khương cùng Claude Code | Nối `gemini-3.8-flash` qua GWAI (`generateContent`, User-Agent riêng); gộp `main` vào nhánh agent: giữ run-4 của Đức (`gpt-4o-mini`) làm Lượt 1, gộp `ai.py` đủ 6 provider, Lượt 2 dùng `gpt-4o-mini` | ✅ | `codebase/ai.py`, `eval/report.md`, `eval/README.md`, `spec.md`, `CP3-CHECKLIST.md` | ~ |
| Khương cùng Codex | Thêm cấu hình riêng cho GWAI qua Chat Completions | 🔄 | `codebase/ai.py`; chờ key và mã model để kiểm kết nối thật | ~ |
| Khương | Gộp nhánh `docs/cp2-benchmark-datacard` vào nhánh agent: giữ luồng B1–B10 do code điều khiển, nhận kho 5 thành phố, kho quán hot, bộ 24 câu, `ai.py` (Gemini/OpenRouter); thêm nhánh lấp khoảng trống (B17, B18) do code tính giờ, model chỉ chọn mã; bỏ tra VIETMAP/Tavily/Google lúc chạy (chờ OQ-22); viết lại `tests/`. Model giả: 24/24 test qua, `check` OK, `eval --try` 3/3; chưa có lượt model thật | 🔄 | `codebase/agent.py`, `codebase/tools.py`, `tests/`, `spec.md`, `data/DATA_CARD.md`, `docs/roa-agent-flow.md` | ~ |
| Khương | Vẽ luồng và kiến trúc agent Roa (sơ đồ lớp, luồng B1–B10, sơ đồ gọi, khung giờ, nhánh ↔ câu thử, giới hạn); ARCHITECTURE v0.5 khớp tên công cụ trong code | ✅ | `docs/roa-agent-flow.md`, `ARCHITECTURE.md` | ~ |
| Khương | Kho địa điểm Đà Lạt (94 nơi: 8 mẫu CP2 + 86 OSM qua Geoapify); `tools.py` đọc kho; `agent.py` luồng nhiều bước (tách yêu cầu, mẫu từ chối/hỏi lại/chưa có dữ liệu/mâu thuẫn ngân sách, kiểm khả thi, bản nháp bằng code, model chọn, kiểm, sửa một lần); DATA_CARD, spec §10. Chạy bằng model giả: `check` OK (cảnh báo 12/20 câu), `eval --try` 3/3 chạy hết; chưa có lượt model thật (chờ OQ-01) | 🔄 | `scripts/build_place_store.py`, `data/places/da-lat.json`, `codebase/tools.py`, `codebase/agent.py`, `data/DATA_CARD.md`, `spec.md` | ~1h |
| Khương | Thiết kế agent Roa v0.4: tra giá, giờ bằng Tavily theo đợt (không tra web lúc chạy), ba lớp kho/cache/DB, khách sạn chỉ gợi ý khu + link kiểm tra phòng; thêm OQ-22 | 🟡 | `docs/roa-agent-design.md`, `docs/OPEN-QUESTIONS.md` | ~ |
| Chờ điền tên người giao việc (cùng Antigravity) | Chạy `eval/run-2.csv` (`openai/gpt-4o-mini`, `11/24`), `simulate --try` (`10/10` thành công), vá JSON mode + retry JSON lỗi + đệm di chuyển `fill_gaps`, chạy `eval/run-3.csv` (`2/24`, 21 câu lỗi `HTTP 402`), cập nhật báo cáo & tổng hợp CP3 | ✅ | `eval/run-2.csv`, `eval/run-3.csv`, `cost/simulate-try.csv`, `codebase/ai.py`, `codebase/agent.py`, `tests/test_agent.py`, `eval/report.md`, `docs/cp3-toan-summary.md` | ~ |
| Chờ điền tên người giao việc (cùng Antigravity) | Mở rộng `eval/benchmark.csv` lên 24 câu (12 nguồn thật từ khảo sát & `data/`), cập nhật `data/DATA_CARD.md`, rà trace `B01` và vá chặn `check_itinerary` trong `codebase/agent.py`, cập nhật `eval/report.md` và `docs/ai-usage.md` | ✅ | `eval/benchmark.csv`, `data/DATA_CARD.md`, `codebase/agent.py`, `tests/test_agent.py`, `eval/report.md`, `docs/ai-usage.md` | ~ |
| Chờ điền tên người giao việc (cùng Antigravity) | Nối Gemini REST API vào `codebase/ai.py`, nâng cấp vòng lặp agent 8 công cụ trong `codebase/agent.py` và bổ sung test lấp khoảng trống | ✅ | `codebase/ai.py`, `codebase/agent.py`, `tests/test_agent.py`, `eval/run-try.csv` | ~ |
| Chờ điền tên người giao việc (cùng Codex) | Cài công cụ tra cứu hai tầng, kiểm lịch, phân tích khoảng trống và tìm điểm gần | ✅ | `codebase/tools.py`, `tests/test_tools.py`, `spec.md` §4 | ~ |

## 2026-11-27

| Thành viên | Task | Trạng thái | Output | Thời gian |
|---|---|---|---|---|
| Khương | README: tên nhóm + lát cắt, xoá mục 0; trang HTML hướng dẫn nhóm (luồng sản phẩm, lát cắt AI, mốc CP, cách làm, cấu trúc repo); WORKFLOW: CP1 chỉ cần phần "Kiểm TEAMS.md" không báo gì | ✅ | `README.md`, `docs/huong-dan-nhom.html`, `docs/WORKFLOW.md` | ~ |
| Khương | Chốt OQ-09: không giới hạn một thành phố, điểm đến bất kỳ trong Việt Nam; bỏ Đà Lạt khỏi canvas, AGENTS, ARCHITECTURE, FEATURE-LIST, WORKFLOW, trang hướng dẫn; OQ-11 cần quyết lại phạm vi kho quán hot | ✅ | `canvas.md`, `AGENTS.md`, `docs/OPEN-QUESTIONS.md`, `ARCHITECTURE.md`, `docs/FEATURE-LIST.md`, `docs/WORKFLOW.md`, `docs/huong-dan-nhom.html` | ~ |
| Khương | Chốt OQ-02, 03, 06, 07, 13, 14, 17, 19, 20, 21 (chờ Đức xác nhận); ADR 0004; sửa tài liệu theo quyết định; WORKFLOW theo slide kickoff; `canvas.md` bản CP1; đưa khung ra gốc repo, đề BTC vào `de-bai/` | ✅ | `docs/OPEN-QUESTIONS.md` v0.3, `docs/adr/0004-…`, `canvas.md`, `docs/WORKFLOW.md` v0.3; `python run.py check` chạy được ở gốc (TEAMS OK) | ~ |
| Khương | Dựng khung tài liệu kỹ thuật: AGENTS, ARCHITECTURE, DATABASE, API_SPEC, quy tắc, ADR, OQ, spec đề xuất và bỏ phiếu, quy trình | ✅ | Nhánh `docs/khung-tai-lieu`; `AGENTS.md`, `ARCHITECTURE.md`, `docs/` | ~1,5h |
| Khương | Script thử thu quán hot TikTok (Tavily + Firecrawl) cho Đà Lạt, đối chiếu cột `trending_spots`: 23 video, có engagement 12/23, chưa có `name`, `place_id` | ✅ | `scripts/spike_tiktok_trending.py`, `data/raw/` (không commit) | ~ |
| Khương | Script thử Google Places (Text Search) cho `search_places` và khớp quán TikTok sang `place_id`; chưa chạy vì `.env` chưa có `GOOGLE_MAPS_API_KEY` | 🟡 | `scripts/spike_google_places.py` | ~ |
| Khương | Bản nháp thiết kế agent Roa với Geoapify (v0.3): công cụ, luồng `generate`, thu độ hot theo đợt (2 chiều), cache; chạy `spike_geoapify.py` cho Đà Lạt: 783 nơi, giờ mở cửa ≈11–15%, giá 0%, `name=` hỏng, khớp TikTok 1/6; script TikTok thêm chiều A (`--from-catalog`), câu tìm kết thúc bằng tên thành phố | 🟡 | `docs/roa-agent-design.md`, `scripts/spike_geoapify.py`, `scripts/spike_tiktok_trending.py`, `.env.example` | ~ |

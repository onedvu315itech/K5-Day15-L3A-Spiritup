# AGENTS.md — hướng dẫn cho coding agent (Claude Code, Cursor, Codex…) làm việc trong repo này

> Ôn lại: ngày 12 · lab ngày 12. Nhóm sửa file này cho khớp bài của mình (thêm quy ước riêng, bỏ dòng không dùng).

## Repo này là gì

Repo nộp bài hackathon AI20K của nhóm: một bản chạy thử AI cho **một lát cắt** (xem `spec.md` §4), kèm bằng chứng, bộ câu thử và mô phỏng chi phí. Mọi câu trả lời phải chạy được bằng các lệnh dưới đây.

### Tổng quan dự án: Partaway — Web app AI Agent lập kế hoạch du lịch nhóm ở Việt Nam

- **Tên sản phẩm & Agent:** Web app **Partaway** và AI agent **Roa**.
- **Vấn đề:** Nhóm bạn đông người đi du lịch thường mất nhiều thời gian chốt lịch trình do:
  - Mỗi người một sở thích, ngân sách khác nhau; bàn qua chat nhóm rất rối.
  - Giờ mở cửa của quán ăn, nhà hàng, khách sạn rời rạc, hay sai, dễ đến nơi mới thấy quán đóng.
  - Quán "hot" phải tự lướt TikTok, Instagram tìm rồi ghi chép thủ công.
- **Giải pháp:** Web app có AI agent. Nhóm trưởng nhập yêu cầu chuyến đi, agent tự lập lịch trình chi tiết theo ngày và giờ dựa trên dữ liệu thật trong khoảng 2 quý đổ lại. Sau đó cả nhóm cùng xem, đề xuất thay đổi và hỏi thêm agent ngay trên giao diện.
- **Tính năng chính:**
  - **Tạo chuyến đi:** Nhập điểm đi, điểm đến, số ngày, số người, ngân sách dự kiến, sở thích và ràng buộc (ăn chay, ít di chuyển, thích chụp ảnh…).
  - **Lập kế hoạch bằng dữ liệu thật:**
    - Kho dữ liệu TikTok / Instagram thu thập trước: các quán đang hot và review thực tế từ người dùng Việt.
    - Google Places API: giờ mở cửa, đánh giá, mức giá, vị trí của quán ăn, nhà hàng, khách sạn, điểm tham quan.
    - Google Maps / Directions: thời gian di chuyển giữa các điểm.
  - **Xếp lịch hợp lý:** Sắp xếp theo giờ mở cửa, tuyến đường, vừa ngân sách và đủ chỗ cho cả nhóm.
  - **Chỉnh sửa plan:** Kéo thả, thêm, xoá, đổi giờ trực tiếp trên giao diện, hoặc nhờ agent sửa bằng ngôn ngữ tự nhiên (agent chỉ sửa phần được yêu cầu và kiểm tra lại giờ mở cửa).
  - **Khung chat hỏi agent:** Hỏi về plan hiện tại (chỗ đậu xe, phương án thay thế khi trời mưa, tổng chi phí mỗi người…).
- **Đầu ra:** Lịch trình dạng timeline theo ngày (giờ, địa điểm, lý do chọn, chi phí ước tính), bản đồ tuyến đi và bảng chi phí theo đầu người.
- **Điểm khác biệt:** Lịch trình dựa trên dữ liệu thật nên đi được ngay, tối ưu cho cả nhóm thay vì một người; gợi ý theo xu hướng mạng xã hội Việt; plan "sống" (sửa được và hỏi được liên tục).
- **Kiến trúc sơ bộ (Web app):**
  - **Frontend:** Trang tạo chuyến đi, timeline plan có thể sửa, bản đồ, khung chat với agent.
  - **Backend + Agent:** Một LLM dùng tool calling (`search_places`, `get_opening_hours`, `get_travel_time`, `get_trending_spots`, `update_plan`). Plan lưu dạng JSON có cấu trúc để cả FE lẫn agent cùng đọc/ghi.
  - **Dữ liệu:** Cache kết quả Google API, kèm một kho "quán hot" thu thập trước từ TikTok/Instagram.
- **Lưu ý phạm vi MVP (2 ngày, 4 người):**
  - Không crawl TikTok/Instagram trực tiếp lúc demo (thu trước tập dữ liệu nhỏ cho 1–2 thành phố demo, ví dụ Đà Lạt hoặc Đà Nẵng, để agent tra từ kho đó).
  - Cache kết quả Google Places API và giới hạn phạm vi thành phố demo để kiểm soát chi phí gọi API.
  - Ưu tiên một luồng chạy trơn tru: tạo chuyến đi → có plan → sửa plan bằng tay và bằng chat → hỏi agent.
  - Dùng chung một link để mọi người cùng sửa rồi bấm làm mới (chưa cần đồng bộ real-time như Google Docs).

## Lệnh

```
python run.py                    # chạy bản chạy thử
python run.py check              # kiểm eval/benchmark.csv + eval/metric_spec.yaml
python run.py eval --try         # thử 3 câu đầu
python run.py eval               # chạy cả bộ → eval/run-N.csv + traces/run-N.jsonl
python run.py score eval/run-N.csv
python run.py simulate --try     # thử mô phỏng chi phí 10 phiên
python run.py simulate           # mô phỏng chi phí → cost/simulate-N.csv
```

Khung chỉ dùng thư viện chuẩn của Python. Thêm thư viện thì ghi vào `requirements.txt`.

## Cấu trúc code

| File | Ai sửa | Hợp đồng |
|---|---|---|
| `codebase/agent.py` | nhóm | `answer(text) -> {"output": str}` — luồng chính, đúng hình dạng ở `spec.md` §4 |
| `codebase/ai.py` | nhóm | `call_model(system, user) -> {"text", "model", "tokens_in", "tokens_out"}`, giữ `@model_call`. Token lấy từ `usage` của API, không ước lượng |
| `codebase/tools.py` | nhóm | mỗi công cụ một hàm có `@tool`, docstring: tên · input · output · có tác động ra ngoài không |
| `codebase/tracing.py`, `eval/run_eval.py`, `cost/simulate.py`, `run.py` | **khung — không sửa** | ghi trace, chạy bộ câu thử, mô phỏng chi phí |

## Luật — agent KHÔNG được làm

- Không commit `.env`, API key, dữ liệu cá nhân thật, nguyên file data BTC cấp.
- Không sửa `eval/run-*.csv`, `cost/simulate-*.csv`, `traces/*` đã chạy (trừ điền cột `pass`, `ghi_chu`).
- Không sửa chuẩn "đạt" (`spec.md` §7), `eval/metric_spec.yaml` sau CP2; không xoá câu thử trượt, không sửa `expected` cho khớp output.
- Không bịa người được phỏng vấn, trích dẫn, câu trả lời khảo sát, số liệu. Số không có nguồn thì ghi rõ *(tự ước tính)*.
- Công cụ có tác động ra ngoài (gửi tin, sửa dữ liệu, chấm điểm): chỉ tạo bản nháp chờ người duyệt.
- Không viết prompt "giấu" câu thử vào code (vd so khớp nguyên văn input của bộ câu thử).

## Quy ước của nhóm

- Ngôn ngữ trả lời người dùng: tiếng Việt
- Phong cách code / đặt tên: __
- Ai duyệt thay đổi do agent tạo trước khi commit: __

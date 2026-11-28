# Reflection — Lê Hữu Toàn

1. **Vai trò + phần mình làm (trỏ tới file / commit):**
   Phụ trách lõi AI agent Roa, bộ câu thử và đánh giá mô hình: xây dựng module tra cứu OpenStreetMap (`5374a86`, `codebase/osm_places.py`), hoàn thiện bộ câu thử `eval/benchmark.csv`, `eval/metric_spec.yaml`, `data/DATA_CARD.md` cho CP2 (`8e005be`, `0e17112`), mở rộng lên 24 câu thử kèm lõi Roa cho CP3 (`2ff8c5a`), và chạy các lượt eval `run-1`–`run-3` cùng bản vá JSON mode (`da57a5b`).

2. **AI hỗ trợ mình thế nào (việc gì, công cụ gì, chỗ nào phải sửa lại output AI):**
   Dùng coding agent để hỗ trợ nối REST API của các nhà cung cấp model trong `codebase/ai.py`, viết vòng lặp agent với `@tool` trong `codebase/agent.py`, mở rộng câu thử `B13`–`B24` từ dữ liệu khảo sát/địa điểm và viết test trong `tests/test_agent.py`. Mình phải tự rà lại trace `run-2`/`run-3`, phát hiện model hay xuất thừa dấu `}` khi gọi `get_travel_time` và bỏ qua kết quả `check_itinerary` khi `valid=False`, nên phải bật `json_object` và để code kiểm soát luồng thay vì để model tự do gọi tool.

3. **Một câu thử trượt của nhóm và mình học được gì từ nó:**
   Ở `eval/run-2.csv`, câu `B17` (lấp khoảng trống 09:00–10:30 ở Hà Nội) trượt vì agent đặt mục mới bắt đầu ngay 09:00 (0 phút đệm di chuyển sau mục trước), khiến `check_itinerary` báo thiếu 1 phút di chuyển và trả về thất bại. Mình học được rằng các ràng buộc thời gian thực tế (giờ mở cửa, đệm di chuyển) phải được tính bằng code rõ ràng chứ không thể tin vào ước lượng của LLM.

# Reflection — Mai Đăng Khương

1. **Vai trò + phần mình làm (trỏ tới file / commit):**
   Phụ trách kiến trúc agent Roa, dữ liệu địa điểm và backend FastAPI: viết tài liệu thiết kế Roa với Geoapify, kho quán hot và cache (`c088600`, `docs/roa-agent-design.md`), script thử nghiệm dữ liệu (`7027454`, `scripts/`), luồng `generate` nhiều bước và sơ đồ (`88aba5e`, `49937b3`), nối `gemini-3.8-flash` qua GWAI và chạy eval 24/24 (`789ee8e`, `4a8f711`), xây dựng backend FastAPI + Geoapify (`fe86fd2`, `4c59cb8`) và kết nối FE–BE (`8cae539`).

2. **AI hỗ trợ mình thế nào (việc gì, công cụ gì, chỗ nào phải sửa lại output AI):**
   Dùng coding agent để triển khai nhanh các endpoint FastAPI, cấu trúc schema dữ liệu địa điểm và tái cấu trúc luồng agent do code điều khiển (`B1`–`B10`) nhằm loại bỏ lỗi tự tính giờ/tiền của model. Mình phải kiểm tra lại và sửa nhiều chỗ quan trọng như thêm `User-Agent` khi Cloudflare chặn `Python-urllib`, chỉnh `check_itinerary` kiểm thêm thời gian di chuyển, và đối chiếu cẩn thận giá token của `gemini-3.8-flash` trong `cost/cost-estimate.md`.

3. **Một câu thử trượt của nhóm và mình học được gì từ nó:**
   Ở `eval/run-2.csv`, 8/24 câu (`B01`–`B05`, `B13`, `B14`, `B22`) trượt do model sinh JSON bị thừa dấu ngoặc `}` khi truyền toạ độ cho `get_travel_time`, làm parser trả `None` và agent in thẳng JSON thô cho người dùng. Bài học rút ra là không để LLM tự tính toán hay tự format dữ liệu phức tạp khi có thể chuyển sang cấu trúc đơn giản theo mã địa điểm và kiểm tra hợp lệ bằng code.

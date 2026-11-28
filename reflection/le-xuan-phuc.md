# Reflection — Lê Xuân Phúc

1. **Vai trò + phần mình làm (trỏ tới file / commit):**
   Phụ trách giao diện Next.js (TypeScript) và luồng tương tác nhóm của Partaway: khởi tạo frontend (`ee0b04d`), cấu hình `.gitignore` (`e6dde96`), xây dựng bộ nhớ hội thoại trượt và API chat (`e25b0aa`), cải thiện logic phiên bản plan, service và kiểm tra mã mời (`306f86b`), và triển khai tính năng tạo đề xuất nháp trong khung chat (`5f44c8a`).

2. **AI hỗ trợ mình thế nào (việc gì, công cụ gì, chỗ nào phải sửa lại output AI):**
   Dùng coding agent để dựng nhanh các component giao diện Next.js (timeline, bảng đề xuất, khung chat, modal góp ý) và kết nối với API backend. Mình phải tự rà lại phân quyền trên giao diện để đảm bảo đúng quy tắc nhóm đã chốt (chỉ nhóm trưởng mới được áp dụng thay đổi thành phiên bản mới, Roa trong chat chỉ trả lời hoặc tạo đề xuất nháp chứ không tự sửa plan).

3. **Một câu thử trượt của nhóm và mình học được gì từ nó:**
   Ở `eval/run-4.csv`, câu `B20` và `B19` cho thấy nếu thiếu dữ liệu chi tiết (homestay/ảnh phòng hoặc quán thiếu giờ mở cửa `None`), câu trả lời rất dễ thiếu nhãn `[Cần kiểm tra & điền tay]` hoặc gợi ý mơ hồ khiến người dùng tưởng hệ thống hỗ trợ tìm kiếm chỗ ở. Mình học được rằng cả backend lẫn UI cần thể hiện rõ giới hạn dữ liệu ("không biết / chưa có dữ liệu") và cho phép người dùng tự điền bổ sung an toàn.

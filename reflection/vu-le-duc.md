# Reflection — Vũ Lê Đức

1. **Vai trò + phần mình làm (trỏ tới file / commit):**
   Đội trưởng nhóm Spiritup, phụ trách định hướng phạm vi sản phẩm Việt Nam (`1295adf`), viết giả thuyết và thiết kế khảo sát Google Form thu 47 phản hồi (`10af473`, `evidence/survey/results.csv`, `evidence/summary.md`), đồng bộ tài liệu `canvas.md`, `spec.md`, `eval/README.md` (`84afda7`, `efa0f70`), bổ sung layout/auth page (`d041bf3`), backend logic (`22044be`) và cập nhật slide (`95f8ae4`).

2. **AI hỗ trợ mình thế nào (việc gì, công cụ gì, chỗ nào phải sửa lại output AI):**
   Dùng coding agent (Antigravity) để rà soát checklist CP1–CP4, soạn câu hỏi khảo sát chọn nhanh, tính thống kê chính xác từ file CSV, đồng bộ `spec.md` và kiểm tra tính nhất quán giữa `metric_spec.yaml` với `eval/README.md`. Mình phải kiểm và sửa lại các chỗ AI thu hẹp nhầm phạm vi chỉ còn Đà Lạt (sửa lại thành cả Việt Nam, demo tại Đà Lạt), xoá bỏ số điện thoại/tên người trả lời trong `results.csv`, và giữ lại phần thiết kế giải pháp để cả nhóm tự thảo luận.

3. **Một câu thử trượt của nhóm và mình học được gì từ nó:**
   Ở `eval/run-4.csv`, câu `B01` (nhóm 6 người, ngân sách 400k/người) trượt vì agent chọn tới 8 điểm (605k/người) rồi kết luận "không khả thi" thay vì tự rút gọn điểm cho vừa ngân sách. Mình học được rằng với bài toán lập lịch có ràng buộc cứng, không thể để model tự đoán số lượng điểm mà phải dùng code kiểm tra và điều phối lại phương án cho đến khi thoả ngân sách.

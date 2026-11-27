# Prompt mẫu: giao coding agent làm một tính năng

Dán prompt dưới đây vào Claude Code / Codex / Cursor / Gemini CLI, thay phần `<…>`. Agent làm theo ba pha; người giao việc kiểm ở giữa các pha.

## Người làm gì giữa các pha

| Sau pha | Người giao việc |
|---|---|
| 1 — Đọc và hỏi | Trả lời câu hỏi; đồng ý kế hoạch hoặc sửa. Câu hỏi chưa ai trả lời được thì thêm vào `docs/OPEN-QUESTIONS.md` và bảo agent bỏ qua phần đó |
| 2 — Làm | Không cần làm gì; agent tự dừng nếu gặp chỗ bị chặn |
| 3 — Kiểm và báo cáo | Đọc diff, chạy lại kiểm tra, sửa `WORKLOG.md` nếu thời gian sai, commit (agent không tự commit) |

---

```text
Việc: <mô tả ngắn, ví dụ "bỏ phiếu và áp dụng đề xuất">
Spec: docs/features/<file>.md (các BR, AC: <liệt kê nếu chỉ làm một phần>)
Nhánh: <type>/<mo-ta> (đã tạo sẵn từ develop)
Người giao việc: <tên>

PHA 1 — ĐỌC VÀ HỎI (chưa sửa file nào)
Đọc AGENTS.md, docs/PROJECT-RULES.md, docs/OPEN-QUESTIONS.md, spec ở trên, và các phần
DATABASE.md / API_SPEC.md / ARCHITECTURE.md mà spec dẫn tới. Đọc code hiện có ở vùng sẽ sửa.
Sau đó trả lời, ngắn gọn:
  A. Hiểu việc: tóm tắt 3–5 dòng sẽ làm gì, không làm gì.
  B. File sẽ tạo / sửa (đường dẫn), và tài liệu phải sửa theo bảng "Sửa gì → ghi ở đâu" trong AGENTS.md.
  C. Chỗ bị chặn: mục nào đụng OQ đang mở hoặc CR chưa duyệt; đề xuất làm phần nào trước.
  D. Chỗ spec mâu thuẫn hoặc thiếu (spec với DATABASE/API_SPEC/code hiện có).
  E. Câu hỏi cho người giao việc (tối đa 5). Không có thì ghi "Không có".
Dừng và chờ trả lời.

PHA 2 — LÀM (sau khi được đồng ý)
- Chỉ làm phần đã thống nhất ở pha 1. Gặp chỗ mới bị chặn thì dừng phần đó, ghi lại, làm tiếp phần khác.
- Viết test cho các AC có cách kiểm T.
- Sửa tài liệu bị ảnh hưởng trong cùng thay đổi: tăng phiên bản, ngày, thêm dòng "Lịch sử thay đổi" (R-04, R-05).
- Không thêm thư viện, không sửa file khung BTC bị cấm, không đọc .env.

PHA 3 — KIỂM VÀ BÁO CÁO
- Chạy: pytest (backend) / npm run lint (frontend) / python run.py check (nếu đụng codebase, eval, cost, TEAMS.md).
- Báo cáo:
  1. Đã làm: theo từng BR/AC, trạng thái qua / chưa / bị chặn.
  2. Kết quả lệnh kiểm tra (dán phần tóm tắt, kể cả lỗi).
  3. Tài liệu đã sửa (file, phiên bản mới).
  4. Việc còn lại và câu hỏi mới (đề xuất thêm vào OPEN-QUESTIONS.md, không tự thêm).
  5. Dòng đề xuất cho WORKLOG.md: | <thành viên> | <việc> | <trạng thái> | <output> | <thời gian hoặc ~> |
  6. Đề xuất commit message theo docs/DEVELOPMENT.md mục 3. KHÔNG tự commit, push.

LUÔN ĐÚNG
- Roa không ghi thẳng vào plan; mọi thay đổi plan qua đề xuất (R-31, BR-02).
- Phiên bản plan bất biến (I1). Quyền kiểm ở backend (R-20).
- Không tự chọn phương án cho câu hỏi còn mở (R-02). Không tự tạo ADR, CR.
- Không đưa key, token, chuỗi kết nối vào code, log, tài liệu.
- Không có mã task trong nhánh, commit, PR.
```

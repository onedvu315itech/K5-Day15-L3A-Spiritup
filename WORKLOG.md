# WORKLOG

Nhật ký việc của nhóm. Mỗi việc xong (hoặc dừng) một dòng, ghi ngay khi xong. Ngày mới nhất ở trên.

- **Trạng thái:** ✅ xong · 🔄 đang làm · ⏸ tạm dừng / bị chặn (ghi lý do ở Output) · ❌ bỏ
- **Output:** file, PR, link deploy, kết quả lệnh
- **Thời gian:** thời gian làm thật; ước lượng thì thêm `~` (ví dụ `~1h`)
- Việc do coding agent làm vẫn ghi tên người giao việc.

## 2026-11-27

| Thành viên | Task | Trạng thái | Output | Thời gian |
|---|---|---|---|---|
| Khương | README: tên nhóm + lát cắt, xoá mục 0; trang HTML hướng dẫn nhóm (luồng sản phẩm, lát cắt AI, mốc CP, cách làm, cấu trúc repo); WORKFLOW: CP1 chỉ cần phần "Kiểm TEAMS.md" không báo gì | ✅ | `README.md`, `docs/huong-dan-nhom.html`, `docs/WORKFLOW.md` | ~ |
| Khương | Chốt OQ-09: không giới hạn một thành phố, điểm đến bất kỳ trong Việt Nam; bỏ Đà Lạt khỏi canvas, AGENTS, ARCHITECTURE, FEATURE-LIST, WORKFLOW, trang hướng dẫn; OQ-11 cần quyết lại phạm vi kho quán hot | ✅ | `canvas.md`, `AGENTS.md`, `docs/OPEN-QUESTIONS.md`, `ARCHITECTURE.md`, `docs/FEATURE-LIST.md`, `docs/WORKFLOW.md`, `docs/huong-dan-nhom.html` | ~ |
| Khương | Chốt OQ-02, 03, 06, 07, 13, 14, 17, 19, 20, 21 (chờ Đức xác nhận); ADR 0004; sửa tài liệu theo quyết định; WORKFLOW theo slide kickoff; `canvas.md` bản CP1; đưa khung ra gốc repo, đề BTC vào `de-bai/` | ✅ | `docs/OPEN-QUESTIONS.md` v0.3, `docs/adr/0004-…`, `canvas.md`, `docs/WORKFLOW.md` v0.3; `python run.py check` chạy được ở gốc (TEAMS OK) | ~ |
| Khương | Dựng khung tài liệu kỹ thuật: AGENTS, ARCHITECTURE, DATABASE, API_SPEC, quy tắc, ADR, OQ, spec đề xuất và bỏ phiếu, quy trình | ✅ | Nhánh `docs/khung-tai-lieu`; `AGENTS.md`, `ARCHITECTURE.md`, `docs/` | ~1,5h |

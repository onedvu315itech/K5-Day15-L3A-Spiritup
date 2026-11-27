## Việc gì

<!-- 1–3 dòng. Tiêu đề PR theo dạng commit: <type>(<scope>): <mô tả>. Không dùng mã task. -->

## Liên quan

- Spec: `docs/features/…` (BR, AC: …)
- Quy tắc / OQ / CR / ADR: …

## Loại thay đổi

- [ ] L0–L2 (không cần CR)
- [ ] L3–L5 — CR: …

## Cách kiểm

- [ ] `pytest` (backend)
- [ ] `npm run lint` (frontend)
- [ ] `python run.py check` (đụng `codebase/`, `eval/`, `cost/`, `TEAMS.md`)
- [ ] Chạy lại eval (đổi prompt, công cụ Roa — R-37)
- [ ] Kiểm tay: …

<!-- Dán tóm tắt kết quả, ảnh chụp màn hình nếu đổi UI. -->

## Tài liệu

- [ ] Đã sửa tài liệu bị ảnh hưởng, tăng phiên bản, thêm "Lịch sử thay đổi" (R-04, R-05)
- [ ] `CHANGELOG.md` (nếu đáng chú ý)
- [ ] `WORKLOG.md` có dòng cho việc này
- [ ] Không có key, token, `.env` trong diff

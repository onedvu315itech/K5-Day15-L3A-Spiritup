# CHANGELOG

Thay đổi đáng chú ý của dự án. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/). Mỗi lần merge `develop` → `main` ở một mốc CP, đổi `[Chưa phát hành]` thành `[CPn] - YYYY-MM-DD` và mở mục `[Chưa phát hành]` mới.

Nhóm: **Thêm** · **Thay đổi** · **Bỏ** · **Sửa lỗi** · **Bảo mật**.

## [Chưa phát hành]

### Thêm

- Khung tài liệu kỹ thuật: `AGENTS.md` (kèm `CLAUDE.md`, `GEMINI.md`), `ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/PROJECT-RULES.md`, `docs/OPEN-QUESTIONS.md`, `docs/DEVELOPMENT.md`, `docs/CHANGE-MANAGEMENT.md`, `docs/CHANGE-REQUESTS.md`, `docs/TEST-STRATEGY.md`, `docs/WORKFLOW.md`, `docs/FEATURE-LIST.md`.
- ADR 0001 (stack), ADR 0002 (chỉ nhóm trưởng sửa plan qua đề xuất và bỏ phiếu), ADR 0003 (lõi agent dùng chung với khung BTC, đề xuất).
- Spec `docs/features/de-xuat-va-bo-phieu.md`, mẫu spec, prompt mẫu cho coding agent.
- `WORKLOG.md`, mẫu pull request.
- ADR 0004: phiếu chỉ để ghi nhận (công khai tên, ngưỡng tham khảo quá bán), nhóm trưởng áp dụng hoặc đóng đề xuất; hạn đề xuất tuỳ chọn; plan v1 do nhóm trưởng duyệt.
- `canvas.md` bản CP1 (Track C, lát cắt `generate`).
- Endpoint `POST /trips/{id}/plan`, `POST /proposals/{id}/apply`, `POST /proposals/{id}/close` trong `docs/API_SPEC.md`.

### Thay đổi

- Chốt OQ-02, OQ-03, OQ-06, OQ-07, OQ-13, OQ-14, OQ-17, OQ-19, OQ-20, OQ-21 (`docs/OPEN-QUESTIONS.md` v0.3). ADR 0002 mục 2 và phần bỏ phiếu ở mục 5 được thay bởi ADR 0004.
- `generate` trả bản nháp hoặc `infeasible`, không tự lưu v1; `answer(text)` gọi `generate`.
- `docs/WORKFLOW.md` v0.3 theo slide kickoff: Form 1, Form 2 (một link, chọn nhánh CP1–CP4), 4 điều kiện cứng, `demo-slides.pdf` ở gốc repo.
- Nội dung `starter-repo/` đưa ra gốc repo; tài liệu đề của BTC chuyển vào `de-bai/`.

### Bỏ

- Biến môi trường `PROPOSAL_TTL_HOURS`.
- Nguyên file data BTC cấp (`de-bai/data/preclass`, `de-bai/data/training-ops`) khỏi repo; giữ trên máy, thêm vào `.gitignore`. Repo chỉ chứa số đã tổng hợp và vài dòng ví dụ (luật dùng dữ liệu, `de-bai/01-challenge-brief.md`).

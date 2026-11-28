# FEATURE-LIST.md — Danh sách tính năng

| | |
|---|---|
| Phiên bản | 0.3 |
| Trạng thái | Nháp |
| Người phụ trách | Đức (đội trưởng) |
| Cập nhật | 2026-11-27 |

Ưu tiên: **P0** = thuộc demo, phải có ở CP4 · **P1** = nên có nếu kịp · **P2** = để sau hackathon.

Giai đoạn (OQ-20): **Trước CP3** = lát cắt AI nộp BTC (`codebase/` + eval), làm trước mọi việc khác · **Sau CP3** = web app, làm sau CP3 hoặc song song khi lát cắt AI đã chạy được qua `run.py`.

Trạng thái spec: `docs/features/README.md`. Cột "Spec" trống nghĩa là chưa viết spec (R-01).

| Tính năng | Ưu tiên | Giai đoạn | Người phụ trách | Spec | Trạng thái |
|---|---|---|---|---|---|
| Lát cắt AI: Roa xếp lịch theo ngày (`generate`) thoả giờ mở cửa, ngân sách, hoặc nói rõ không xếp được; `answer(text)` gọi `generate` | P0 | Trước CP3 | Toàn | `spec.md` (gốc repo) | Chưa làm |
| Bộ câu thử + eval cho `generate` (`eval/benchmark.csv`, `run.py eval`) | P0 | Trước CP3 | Toàn, cả nhóm | `spec.md` §5–§7 | Chưa làm |
| Bằng chứng pain: đào review công khai + form khảo sát người ngoài nhóm | P0 | Trước CP3 | Cả nhóm | `evidence/` | Đang làm |
| Tạo chuyến đi + link mời + tham gia bằng tên | P0 | Sau CP3 | Khương, Phúc | [frontend-screens.md](../frontend/docs/frontend-screens.md) | Nháp |
| Nhóm trưởng xem bản nháp `generate`, duyệt thành v1 | P0 | Sau CP3 | Khương, Phúc | [de-xuat-va-bo-phieu.md](features/de-xuat-va-bo-phieu.md) | Nháp |
| Xem plan theo ngày (timeline, chi phí, cảnh báo) | P0 | Sau CP3 | Phúc | [frontend-screens.md](../frontend/docs/frontend-screens.md) | Nháp |
| Đề xuất sửa plan, bỏ phiếu (ghi nhận), nhóm trưởng áp dụng / đóng | P0 | Sau CP3 | Khương, Phúc | [de-xuat-va-bo-phieu.md](features/de-xuat-va-bo-phieu.md) | Nháp |
| Lịch sử phiên bản, so sánh, khôi phục | P0 | Sau CP3 | Khương, Phúc | [de-xuat-va-bo-phieu.md](features/de-xuat-va-bo-phieu.md) | Nháp |
| Hỏi Roa về plan (`ask`, chỉ đọc), hội thoại chung cả nhóm | P0 | Sau CP3 | Toàn, Phúc | [frontend-screens.md](../frontend/docs/frontend-screens.md) | Nháp |
| Form góp ý của thành viên, hộp góp ý của nhóm trưởng | P0 | Sau CP3 | Khương, Phúc | [de-xuat-va-bo-phieu.md](features/de-xuat-va-bo-phieu.md) | Nháp |
| Nhờ Roa soạn đề xuất (`draft`) | P1 | Sau CP3 | Toàn | [de-xuat-va-bo-phieu.md](features/de-xuat-va-bo-phieu.md) | Nháp |
| Kho quán hot Đà Lạt (thu trước, làm sạch) | P0 | Trước CP3 nếu `generate` dùng | Cả nhóm | — | Chưa làm |
| Cập nhật gần thời gian thực (polling) | P1 | Sau CP3 | Phúc, Khương | [frontend-screens.md](../frontend/docs/frontend-screens.md) | Nháp |
| Bản đồ các điểm trong ngày | P1 | Sau CP3 | Phúc | — | Chưa làm |
| Bình chọn tự do giữa nhiều phương án | P2 | — | — | — | Chờ OQ-05 |
| Đăng nhập tài khoản | P2 | — | — | — | Không làm ở MVP: đã chốt link mời + token (OQ-06) |

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Đức | Bản đầu | ADR 0002 |
| 0.2 | 2026-11-27 | Khương | Thêm cột Giai đoạn; thêm lát cắt AI, eval, bằng chứng, duyệt v1 | OQ-19, OQ-20, ADR 0004 |
| 0.3 | 2026-11-27 | Phúc, Khương| Gắn spec `docs/features/frontend-screens.md` cho các màn hình giao diện MVP </br>Bỏ "Đà Lạt" khỏi kho quán hot; bỏ dòng "Nhiều thành phố ngoài Đà Lạt" vì điểm đến bất kỳ trong Việt Nam đã là mặc định | `docs/features/frontend-screens.md` </br>OQ-09 |

# TEST-STRATEGY.md — Chiến lược kiểm thử

| | |
|---|---|
| Phiên bản | 0.2 |
| Trạng thái | Nháp |
| Người phụ trách | Khương (backend), Toàn (agent) |
| Người duyệt | Đức |
| Cập nhật | 2026-11-27 |

Hackathon 2 ngày: test tự động tập trung vào chỗ sai thì hỏng dữ liệu (bỏ phiếu, áp dụng đề xuất, phiên bản) và chỗ BTC chấm (eval agent). Giao diện kiểm tay theo kịch bản demo.

## 1. Các lớp

| Lớp | Công cụ | Phạm vi | Ai | Khi nào chạy |
|---|---|---|---|---|
| Unit backend | `pytest` | `plan_service` (áp dụng `ops`, diff, `touched_items`), schema plan | Khương | Mỗi PR backend |
| Service + DB | `pytest` + PostgreSQL thật (local hoặc schema test trên Supabase) | `proposal_service`, `suggestion_service`, quyền | Khương | Mỗi PR backend |
| API | `pytest` + `httpx` (`TestClient`) | Mã lỗi, quyền theo `API_SPEC.md` mục 1.3, 1.4 | Khương | Mỗi PR đổi API |
| Agent (offline) | `pytest` với model giả | Parse và kiểm schema `generate`, `draft`; thử lại một lần (R-33) | Toàn | Mỗi PR `codebase/` |
| Eval agent (BTC) | `python run.py eval`, `score` | Chất lượng Roa trên `eval/benchmark.csv` theo chuẩn "đạt" `spec.md` §7 | Toàn | Đổi prompt/công cụ (R-37); CP3, CP4 |
| Khung BTC | `python run.py check` | Benchmark, metric, `TEAMS.md` | Ai đụng | Trước merge (R-61) |
| Frontend | `npm run lint`, `tsc` | Kiểu, lỗi cú pháp | Phúc | Mỗi PR frontend |
| Kiểm tay / demo | Kịch bản mục 3 | Lát cắt demo end-to-end | Đức | Trước mỗi lần merge `develop` → `main` |

## 2. Trường hợp bắt buộc có test (R-60)

| Nhóm | Trường hợp |
|---|---|
| Áp dụng `ops` | 4 loại `op`; `item_id` không tồn tại → `invalid_ops`; giờ `end <= start`; ngày ngoài chuyến đi; id mới không trùng (I7) |
| Bỏ phiếu | Phiếu không đổi trạng thái đề xuất; `majority` đúng theo ngưỡng; đổi ý; bỏ lại cùng giá trị; phiếu vào đề xuất đã đóng → 410 |
| Áp dụng, đóng | Nhóm trưởng áp dụng khi đạt và khi chưa đạt đa số → phiên bản mới, lưu `votes_at_decision`; đóng → `reference` (`leader_closed`); thành viên gọi → 403; áp dụng đề xuất đã đóng → 410 |
| Duyệt v1 | `generate` không ghi `plan_versions`; `POST /plan` tạo v1; gọi lại khi đã có v1 → 409 `plan_exists`; plan sai schema → 422 |
| Đồng thời | Hai request áp dụng song song → đúng một phiên bản mới (I2); phiếu đến cùng lúc với áp dụng không làm hỏng `votes_at_decision` |
| Stale | Không đụng mục → áp dụng lên bản hiện tại; đụng mục → `stale`; đề xuất mở khác bị `stale` sau khi áp dụng |
| Hết hạn | Có đặt hạn và quá `expires_at` → `reference` khi đọc, bỏ phiếu, áp dụng; không đặt hạn → không bao giờ hết hạn |
| Khôi phục | Tạo phiên bản mới bằng bản cũ; bản cũ còn nguyên (I1) |
| Quyền | Thành viên gọi API nhóm trưởng → 403; token chuyến khác → 404 |
| Sự kiện | Mỗi thay đổi trạng thái có `trip_events` (I8) |

Ngưỡng phiếu là tham số trong test; thời gian dùng đồng hồ giả để kiểm hạn.

## 3. Kịch bản kiểm tay (lát cắt demo)

Bốn trình duyệt (hoặc cửa sổ ẩn danh): A nhóm trưởng, B, C, D thành viên. Trên bản preview Vercel + Render.

1. A tạo chuyến đi Đà Lạt 3N2Đ, 4 người → nhận link mời. B, C, D tham gia.
2. A bấm tạo lịch trình → v1 hiện đủ 3 ngày, có giờ, chi phí, nguồn; có ít nhất một quán từ kho quán hot.
3. B hỏi Roa "ngày 2 đi lại tổng bao lâu?" → có câu trả lời dựa trên v1.
4. B gửi góp ý cho ngày 2. A thấy trong hộp góp ý, chọn "Tạo đề xuất".
5. A sửa, gửi đề xuất → B, C, D thấy thẻ đề xuất trong ≤ 5 giây.
6. B, C đồng ý → v2 được tạo; mọi người thấy v2, lịch sử có dòng mới.
7. A tạo đề xuất thứ hai; C, D không đồng ý → đề xuất thành "tham khảo".
8. A mở lịch sử, so v1 với v2, khôi phục v1 qua đề xuất.
9. Thành viên không thấy nút sửa, không gọi được API sửa (thử bằng `curl`).

Ghi kết quả vào `WORKLOG.md` (✅ / ❌ từng bước).

## 4. Dữ liệu test

- Chuyến đi mẫu và plan mẫu trong `backend/tests/fixtures/` (JSON, không gọi Google).
- Công cụ Google trong test dùng phản hồi ghi sẵn; không tốn hạn mức.
- Không dùng dữ liệu cá nhân thật.

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Khương | Bản đầu | ADR 0002 |
| 0.2 | 2026-11-27 | Khương | Đổi trường hợp test bỏ phiếu, thêm áp dụng / đóng, duyệt v1; hạn tuỳ chọn | ADR 0004 |

# CHANGE-REQUESTS.md — Sổ yêu cầu thay đổi

| | |
|---|---|
| Phiên bản | 0.2 |
| Trạng thái | Đang dùng |
| Người phụ trách | Đức (đội trưởng) |
| Cập nhật | 2026-11-27 |

Thay đổi loại L3–L5 (`docs/CHANGE-MANAGEMENT.md` mục 2). Mới nhất ở trên.

## Đang mở

| Mã | Ngày mở | Người mở | Loại | Thay đổi | Lý do | Ảnh hưởng | Người quyết | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| CR-001 | 2026-11-28 | Khương (cùng Claude Code) | L4 | Mọi thành viên tạo thẻ đề xuất (bỏ form góp ý); thẻ có hạn cố định 48 giờ rồi thành tham khảo | Yêu cầu của nhóm trưởng sản phẩm 28/11: nhóm muốn góp ý thẳng bằng thẻ đề xuất có thể bỏ phiếu | ADR 0002, ADR 0004 điểm 4, OQ-03; `API_SPEC` v0.4, `DATABASE` v0.4, `ARCHITECTURE` v0.10; code backend đã làm theo | Đức | Nháp, chờ duyệt |

### CR-001 — Thẻ đề xuất của mọi thành viên, hạn 48 giờ

- **Loại:** L4 (đổi quyết định đã chốt ở ADR 0002, ADR 0004)
- **Người mở / ngày:** Khương (cùng Claude Code), 2026-11-28. **Nháp, chờ Đức duyệt.**
- **Hiện tại:** chỉ nhóm trưởng tạo đề xuất; thành viên gửi form góp ý (`suggestions`). Hạn đề xuất là tuỳ chọn, nhóm trưởng đặt (OQ-03, ADR 0004 điểm 4).
- **Đề xuất:**
  1. Mọi thành viên (vào nhóm qua link mời) tạo thẻ đề xuất sửa hoặc khôi phục; người tạo tự tính đồng ý, rút được thẻ của mình.
  2. Bỏ form góp ý (`suggestions` và mục 5 `API_SPEC`).
  3. Thẻ mở 48 giờ (`PROPOSAL_TTL_HOURS`), quá hạn thành `reference` / `expired`: vẫn xem để tham khảo, không bỏ phiếu, không áp dụng.
  4. Giữ nguyên: **chỉ nhóm trưởng áp dụng hoặc đóng thẻ** (sửa plan); phiếu chỉ ghi nhận; v1 do nhóm trưởng duyệt; phiên bản bất biến.
- **Lý do:** yêu cầu sản phẩm ngày 28/11; form góp ý thêm một bước nhóm trưởng phải chuyển thành đề xuất, thẻ đề xuất cho cả nhóm bỏ phiếu ngay.
- **Ảnh hưởng:** `docs/API_SPEC.md` v0.4 (quyền, `POST /proposals`, `withdraw`, mục 5), `docs/DATABASE.md` v0.4 (`proposals.author_id`, `expires_at`), `ARCHITECTURE.md` v0.10 (mục 4.3, 6.4); spec đề xuất trong `docs/features/`; màn hình frontend (nút tạo thẻ cho thành viên, bỏ form góp ý); bảng `suggestions` để nguyên, không dùng. Không đụng eval.
- **Phương án khác đã cân nhắc:** giữ form góp ý song song (hai đường làm cùng một việc); hạn tuỳ chọn như OQ-03 (thẻ cũ tồn đọng).
- **Quyết định:** (Đức, ngày, nội dung). Code backend đã làm theo đề xuất này trên nhánh `feat/backend-kho-du-lieu`; nếu không duyệt thì đổi `proposal_service.create` về kiểm `require_leader` và bỏ hạn mặc định.

## Đã đóng

| Mã | Ngày mở | Loại | Thay đổi | Kết quả | Ngày đóng | PR / ADR |
|---|---|---|---|---|---|---|
| — | | | | | | |

## Mẫu ghi chi tiết

Dùng khi CR cần giải thích dài hơn một dòng; đặt ngay dưới bảng.

```markdown
### CR-001 — <tên ngắn>

- **Loại:** L3 / L4 / L5
- **Người mở / ngày:**
- **Hiện tại:**
- **Đề xuất:**
- **Lý do:**
- **Ảnh hưởng:** tài liệu, bảng, endpoint, màn hình, eval
- **Phương án khác đã cân nhắc:**
- **Quyết định:** (người quyết, ngày, nội dung)
```

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Đức | Tạo sổ trống | — |
| 0.2 | 2026-11-28 | Khương | Thêm nháp CR-001 (thẻ đề xuất của mọi thành viên, hạn 48 giờ), chờ Đức duyệt | Yêu cầu 28/11 |

# ADR 0004 — Phiếu chỉ để ghi nhận, nhóm trưởng quyết áp dụng; v1 do nhóm trưởng duyệt

| | |
|---|---|
| Trạng thái | Đã chấp nhận |
| Ngày | 2026-11-27 |
| Người quyết | Khương (chờ Đức xác nhận khi duyệt PR) |
| Thay thế | ADR 0002, mục 2 và phần "cũng qua bỏ phiếu" ở mục 5 |

## Bối cảnh

ADR 0002 cho backend tự áp dụng đề xuất khi đủ phiếu đồng ý, và tự chuyển sang "tham khảo" khi hết hạn hoặc không thể đủ phiếu. Khi chốt OQ-02, OQ-03, OQ-13, OQ-17, nhóm thấy:

- Nhóm bạn đi chơi hay có người không bỏ phiếu; nếu phiếu quyết định thì plan bị kẹt, phải đặt hạn để mở khoá.
- Người chịu trách nhiệm cho lịch trình là nhóm trưởng; nhóm muốn giữ một người quyết, phiếu dùng để nhóm trưởng thấy ý kiến của cả nhóm và để lịch sử ghi lại ai đồng ý.
- Plan v1 do Roa tạo cần có người xem trước khi thành bản chính thức.

## Quyết định

1. **Phiếu chỉ để ghi lại biểu quyết.** Thành viên bỏ phiếu đồng ý / không đồng ý, đổi ý được khi đề xuất còn mở. Phiếu **công khai tên** người bỏ (OQ-17).
2. **Ngưỡng tham khảo:** quá bán số thành viên, `floor(n/2) + 1`, `n` chốt lúc tạo đề xuất. Nhóm trưởng tự có một phiếu đồng ý khi tạo. Giao diện hiện "Đạt đa số" hoặc "Chưa đạt đa số" (OQ-02).
3. **Nhóm trưởng quyết.** Với đề xuất đang mở, nhóm trưởng chọn:
   - **Áp dụng**: backend tạo phiên bản mới, đề xuất `applied`. Chưa đạt đa số vẫn áp dụng được; giao diện hỏi xác nhận trước. Kết quả phiếu tại lúc quyết được lưu cùng đề xuất và hiện trong lịch sử phiên bản.
   - **Đóng**: đề xuất thành `reference` (để tham khảo), không áp dụng.
   - **Rút**: đề xuất thành `withdrawn` (giữ như ADR 0002).
   Backend không tự áp dụng hay tự đóng đề xuất theo số phiếu.
4. **Hạn đề xuất là tuỳ chọn.** Không có hạn mặc định. Nhóm trưởng có thể đặt hạn khi tạo đề xuất; quá hạn mà nhóm trưởng chưa quyết thì đề xuất thành `reference` (`expired`), kiểm lười khi đọc (OQ-03).
5. **Khôi phục phiên bản cũ** là đề xuất `revert`, nhóm trưởng áp dụng như mọi đề xuất. Lịch sử vẫn bất biến.
6. **Plan v1:** `generate` chỉ trả **bản nháp**, không lưu. Nhóm trưởng xem, có thể tạo lại hoặc chỉnh, rồi **duyệt** thì backend mới lưu thành v1. Không qua bỏ phiếu (OQ-13).

Giữ nguyên từ ADR 0002: chỉ nhóm trưởng sửa plan; mọi thay đổi sau v1 là đề xuất có `base_version` và `ops`; kiểm đề xuất cũ (`stale`) khi áp dụng; thành viên góp ý qua form; Roa không bao giờ tự áp dụng thay đổi.

## Phương án đã cân nhắc

| Phương án | Được | Mất |
|---|---|---|
| Đủ phiếu thì backend tự áp dụng (ADR 0002) | Đồng thuận rõ ràng; nhóm trưởng không áp đặt được | Plan kẹt khi có người không bỏ phiếu; phải có hạn mặc định; nhiều đề xuất thành "tham khảo" chỉ vì thiếu phiếu |
| **Phiếu để ghi nhận, nhóm trưởng quyết** | Plan không kẹt; một người chịu trách nhiệm; lịch sử vẫn ghi ai đồng ý | Nhóm trưởng có thể áp dụng khi đa số không đồng ý. Giảm bằng: phiếu công khai, kết quả phiếu lưu trong lịch sử, giao diện hỏi xác nhận khi chưa đạt đa số |
| Bỏ hẳn bỏ phiếu, chỉ có góp ý | Đơn giản nhất | Mất tiếng nói nhanh của thành viên trên từng thay đổi |

## Hệ quả

- API: thêm `POST /proposals/{id}/apply` và `POST /proposals/{id}/close` (nhóm trưởng); bỏ phiếu không còn kích hoạt áp dụng. `POST /trips/{id}/generate` trả bản nháp; thêm `POST /trips/{id}/plan` để nhóm trưởng duyệt v1 (`docs/API_SPEC.md`).
- Dữ liệu: `proposals.expires_at` cho phép null; `close_reason` bỏ `not_enough_votes`, thêm `leader_closed`; thêm `votes_at_decision` (`docs/DATABASE.md`). Bỏ biến `PROPOSAL_TTL_HOURS`.
- Đồng thời: tranh chấp chỉ còn giữa thao tác áp dụng của nhóm trưởng và phiếu đến cùng lúc; vẫn khoá dòng `trips` trong transaction (`ARCHITECTURE.md` mục 6).
- Spec `docs/features/de-xuat-va-bo-phieu.md` lên v0.2: sửa BR-04, BR-06, BR-07, BR-08, BR-17 và AC-3, AC-4, AC-5, AC-8, AC-12.
- Kịch bản demo đổi: thành viên bỏ phiếu, thanh phiếu báo "Đạt đa số", nhóm trưởng bấm "Áp dụng".

# ADR 0002 — Chỉ nhóm trưởng sửa plan, qua đề xuất và bỏ phiếu

| | |
|---|---|
| Trạng thái | Đã chấp nhận; mục 2 và phần bỏ phiếu ở mục 5 thay bởi ADR 0004 |
| Ngày | 2026-11-27 |
| Người quyết | Cả nhóm (họp 27/11) |
| Thay thế | — |

## Bối cảnh

Nhiều người cùng sửa một lịch trình và cùng chat với agent gây rối: sửa chồng lên nhau, agent nhận yêu cầu mâu thuẫn, không ai biết bản nào là bản chốt, chi phí gọi LLM tăng theo số người. Nhóm cần một cách sửa plan mà cả nhóm vẫn có tiếng nói nhưng chỉ có một luồng thay đổi.

## Quyết định

1. **Chỉ nhóm trưởng sửa plan.** Mỗi lần sửa (tự sửa, nhờ Roa soạn, hoặc từ góp ý) tạo một **đề xuất** gồm danh sách thao tác (`ops`) trên một phiên bản gốc (`base_version`).
2. **Thành viên bỏ phiếu** đồng ý / không đồng ý. Đủ phiếu đồng ý → backend áp dụng, tạo phiên bản mới. Không đủ (hết hạn hoặc không thể đủ nữa) → đề xuất ở trạng thái **tham khảo**, không áp dụng, vẫn xem được.
3. **Thành viên** không sửa plan; họ **gửi góp ý** qua form cho nhóm trưởng, **bỏ phiếu**, và **hỏi Roa** về plan hiện tại (chỉ đọc).
4. **Roa** không bao giờ tự áp dụng thay đổi. Roa chỉ trả lời, hoặc soạn `ops` nháp khi nhóm trưởng nhờ.
5. **Lịch sử phiên bản bất biến.** Mỗi lần áp dụng tạo phiên bản mới; không ghi đè. Khôi phục bản cũ là một đề xuất mới và cũng qua bỏ phiếu.

Chi tiết còn mở: ngưỡng phiếu (OQ-02), thời hạn (OQ-03), v1 không qua phiếu (OQ-13).

> Ghi chú 2026-11-27: OQ-02, OQ-03, OQ-13 đã chốt ở [ADR 0004](0004-phieu-de-ghi-nhan-nhom-truong-quyet.md). Phiếu chỉ để ghi nhận, nhóm trưởng quyết áp dụng; mục 2 và phần "cũng qua bỏ phiếu" ở mục 5 không còn hiệu lực.

## Phương án đã cân nhắc

| Phương án | Được | Mất |
|---|---|---|
| Mọi người sửa trực tiếp, đồng bộ thời gian thực (kiểu Google Docs) | Linh hoạt | Xung đột, cần CRDT/khoá; khó với 2 ngày; không có bản "chốt" |
| Khoá mềm theo mục (ai mở mục trước thì sửa) | Ít xung đột | Vẫn nhiều luồng thay đổi; plan dễ trôi khỏi đồng thuận |
| Mọi người tạo đề xuất, cả nhóm bỏ phiếu | Công bằng | Nhiều đề xuất chồng nhau, stale nhiều; người đề xuất khó tổng hợp |
| **Nhóm trưởng là người sửa duy nhất, cả nhóm bỏ phiếu** | Một luồng thay đổi; vẫn có đồng thuận; dễ demo | Nhóm trưởng thành nút thắt; cần form góp ý để thành viên có tiếng nói |

## Hệ quả

- Không cần khoá theo mục; rủi ro đồng thời chỉ còn ở bỏ phiếu và nhiều đề xuất mở cùng lúc (`ARCHITECTURE.md` mục 6).
- Plan phải là JSON có `id` mục cố định để `ops`, diff và phát hiện đề xuất cũ hoạt động (`docs/DATABASE.md` mục 3).
- Cần màn hình: lịch sử phiên bản, tab "Đề xuất", form góp ý, hộp góp ý của nhóm trưởng.
- Số lần gọi LLM tốn kém (`generate`, `draft`) chỉ từ nhóm trưởng; thành viên chỉ gọi `ask`, có giới hạn tần suất.
- Spec chi tiết: `docs/features/de-xuat-va-bo-phieu.md`.

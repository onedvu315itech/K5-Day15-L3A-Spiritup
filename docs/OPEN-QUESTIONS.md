# OPEN-QUESTIONS.md — Câu hỏi còn mở

| | |
|---|---|
| Phiên bản | 0.3 |
| Trạng thái | Đang dùng |
| Người phụ trách | Đức (đội trưởng) |
| Cập nhật | 2026-11-27 |

Câu hỏi chưa có người quyết. Phần việc phụ thuộc câu hỏi còn **Mở** thì không làm (R-02). Trong tài liệu khác, chỗ chờ câu hỏi đánh dấu `[NEEDS CLARIFICATION: OQ-xx]`.

**Cách dùng:**

- Thêm câu hỏi: số kế tiếp, không dùng lại số. Ghi rõ phương án đang nghiêng (nếu có) và cái gì bị chặn.
- Khi có quyết định: chuyển dòng sang **Đã chốt**, ghi ngày, người quyết, nội dung; sửa các tài liệu đang đánh dấu `NEEDS CLARIFICATION` (tìm theo mã) trong cùng PR. Quyết định lớn (stack, quyền, kiến trúc) viết thêm ADR.
- Câu hỏi không còn cần: **Bỏ**, ghi lý do.
- "Đang nghiêng" chỉ là phương án tạm để không ai bị chặn hoàn toàn; chưa phải quyết định. Làm theo phương án đang nghiêng thì giữ phần đó dễ đổi và ghi mã OQ trong PR.

## Đang mở

| Mã | Câu hỏi | Đang nghiêng | Chặn | Người quyết | Hạn |
|---|---|---|---|---|---|
| OQ-01 | Dùng LLM nào (nhà cung cấp, model)? | Model gọi công cụ ổn định, tiếng Việt tốt, trả JSON đúng schema, có gói miễn phí hoặc rẻ. Để quyết sau; trong lúc chờ, code chỉ gọi model qua `call_model()` để đổi model không phải sửa chỗ khác | Agent `generate`, `draft`, `ask`; eval CP3; `cost/` | Toàn + Đức | Trước CP3 (10:00 28/11) |
| OQ-04 | Đề xuất `reference` có được mở lại / áp dụng sau không? | Không mở lại; nhóm trưởng "tạo đề xuất mới từ đề xuất này" | UI tab "Đề xuất" | Đức | CP3 |
| OQ-05 | Có cần bình chọn tự do (ví dụ "chọn 1 trong 3 quán") ngoài bỏ phiếu đề xuất? | Chưa làm ở MVP; nhóm trưởng tạo nhiều đề xuất | Phạm vi | Cả nhóm | CP2 |
| OQ-08 | Lõi Roa đặt trong `codebase/` và backend import, để eval của BTC đo đúng lõi web dùng? | Có (ADR 0003, đề xuất) | Cấu trúc backend, deploy Render | Toàn + Khương | CP2 |
| OQ-09 | Thành phố demo là Đà Lạt? Thêm thành phố nào? | Chỉ Đà Lạt | Kho quán hot, benchmark | Cả nhóm | CP1 |
| OQ-10 | Cập nhật thời gian thực: polling 5 giây, SSE hay Supabase Realtime? | Polling `GET /updates` (Render ngủ, ít phụ thuộc) | Frontend, `trip_events` | Phúc + Khương | CP2 |
| OQ-11 | Kho quán hot: thu từ đâu, bằng cách nào, có hợp điều khoản TikTok/Instagram không? Ai thu? | Tự thu tay ~50 quán Đà Lạt, chỉ thông tin công khai | `trending_spots`, `data/DATA_CARD.md` | Cả nhóm | CP3 |
| OQ-12 | Cache Google bao lâu? | Chi tiết, giờ mở cửa 7 ngày; tìm kiếm 1 ngày; đường đi 1 ngày | `places_cache` | Khương | CP3 |
| OQ-15 | Giới hạn số thành viên tham gia (bằng `group_size` hay tối đa 20)? | Tối đa 20, không theo `group_size` | `POST /join` | Đức | CP3 |
| OQ-16 | Muốn Roa tạo lại toàn bộ plan sau v1 thì làm sao? | Đề xuất `edit` với `ops` thay toàn bộ ngày; chưa làm ở MVP | `POST /generate`, đề xuất | Toàn | CP3 |
| OQ-18 | Ai giữ key Google Maps, key LLM; hạn mức chi bao nhiêu? | Đức giữ, đặt giới hạn chi trên console | Deploy, `cost/` | Đức | CP2 |

## Đã chốt

| Mã | Câu hỏi | Quyết định | Ngày | Người quyết | Ghi ở |
|---|---|---|---|---|---|
| — | Ai được sửa plan khi nhiều người cùng chỉnh? | Chỉ nhóm trưởng; mọi lần sửa là đề xuất. Phần "đủ phiếu thì tự áp dụng" đã được thay bằng OQ-02 bên dưới | 2026-11-27 | Cả nhóm (họp) | ADR 0002, ADR 0004 |
| — | Stack | Next.js/Vercel, FastAPI/Render, PostgreSQL/Supabase | 2026-11-27 | Cả nhóm (họp) | ADR 0001 |
| OQ-02 | Ngưỡng phiếu; phiếu nhóm trưởng; phiếu có quyết định không? | Ngưỡng tham khảo là quá bán số thành viên (`floor(n/2)+1`, `n` chốt lúc tạo đề xuất), nhóm trưởng tự tính một phiếu đồng ý. **Phiếu chỉ để ghi lại biểu quyết**; nhóm trưởng là người quyết áp dụng hay đóng đề xuất, kể cả khi chưa đạt đa số. Backend không tự áp dụng, không tự đóng theo số phiếu | 2026-11-27 | Khương (chờ Đức xác nhận) | ADR 0004, `docs/features/de-xuat-va-bo-phieu.md` |
| OQ-03 | Đề xuất mở hết hạn sau bao lâu? | Không có hạn mặc định. Đề xuất chỉ hết hạn khi nhóm trưởng đặt hạn lúc tạo; quá hạn mà chưa quyết thì thành `reference` | 2026-11-27 | Khương (chờ Đức xác nhận) | ADR 0004, `docs/DATABASE.md` 2.4 |
| OQ-06 | Xác thực | Vào bằng link mời, nhập tên hiển thị, backend cấp token (lưu băm). Mất token thì tham gia lại bằng link mời | 2026-11-27 | Khương | `ARCHITECTURE.md` mục 9, `docs/API_SPEC.md` 1.2 |
| OQ-07 | Để code, tài liệu trong `starter-repo/` hay đưa ra gốc repo? | Đưa nội dung `starter-repo/` ra gốc repo. Tài liệu đề bài của BTC chuyển vào `de-bai/`; data BTC cấp ở `de-bai/data/` chỉ để trên máy, không commit | 2026-11-27 | Khương (chờ Đức xác nhận) | `docs/DEVELOPMENT.md` mục 1 |
| OQ-13 | Plan v1 do Roa tạo có được áp dụng thẳng, không qua bỏ phiếu? | Không qua bỏ phiếu. `generate` trả bản nháp; nhóm trưởng xem rồi duyệt thì mới lưu thành v1 | 2026-11-27 | Khương (chờ Đức xác nhận) | ADR 0004, `docs/API_SPEC.md` mục 3 |
| OQ-14 | Hội thoại với Roa là chung cả nhóm hay riêng từng người? | Chung cả nhóm: mọi thành viên thấy câu hỏi và câu trả lời của nhau | 2026-11-27 | Khương | `docs/DATABASE.md` 2.7, `docs/API_SPEC.md` mục 6 |
| OQ-17 | Phiếu công khai tên người bỏ hay ẩn danh? | Công khai tên người bỏ | 2026-11-27 | Khương | `docs/API_SPEC.md` mục 4 |
| OQ-19 | Lát cắt nộp BTC và quyết định AI trung tâm | Quyết định trung tâm là `generate`: Roa xếp lịch trình theo ngày, thoả giờ mở cửa và ngân sách, hoặc nói rõ là không xếp được (kèm lý do). `answer(text)` gọi `generate`; bộ câu thử đo `generate`. `ask`, `draft` là phần phụ | 2026-11-27 | Khương (chờ Đức xác nhận) | `canvas.md`, ADR 0003, `ARCHITECTURE.md` 3.3 |
| OQ-20 | Trước CP3, web app làm đến đâu? | Ưu tiên `codebase/` + eval đến CP3. Web app (Vercel, Render, đề xuất, bỏ phiếu) làm sau, hoặc song song khi lát cắt AI đã chạy | 2026-11-27 | Khương (chờ Đức xác nhận) | `docs/WORKFLOW.md` mục 3 |
| OQ-21 | Nguồn bằng chứng pain | Nguồn chính: review công khai. Nguồn kiểm lại: form khảo sát nhóm đã tạo cho người ngoài nhóm điền. Kết quả lưu ở `evidence/` | 2026-11-27 | Khương (chờ Đức xác nhận) | `canvas.md` dòng 4, `docs/WORKFLOW.md` |

## Đã bỏ

| Mã | Câu hỏi | Lý do | Ngày |
|---|---|---|---|
| — | | | |

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Đức | Bản đầu: OQ-01 – OQ-18 | Họp nhóm 27/11 |
| 0.2 | 2026-11-27 | Khương | Thêm OQ-19 (lát cắt, quyết định AI trung tâm), OQ-20 (mức làm web app trước CP3), OQ-21 (nguồn bằng chứng pain) | Đối chiếu yêu cầu BTC |
| 0.3 | 2026-11-27 | Khương | Chốt OQ-02, 03, 06, 07, 13, 14, 17, 19, 20, 21. OQ-01 để quyết sau. Các OQ còn lại giữ mở với phương án đang nghiêng | Quyết định của Khương, chờ Đức xác nhận |

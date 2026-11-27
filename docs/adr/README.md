# ADR — Quyết định kiến trúc

Mỗi quyết định lớn (stack, host, quyền, cấu trúc lõi) là một file `NNNN-<mo-ta-khong-dau>.md`. ADR ghi **vì sao** chọn, không chỉ chọn gì.

## Quy ước

- Số tăng dần, 4 chữ số, không dùng lại.
- Trạng thái: **Đề xuất** → **Đã chấp nhận** · **Từ chối** · **Thay thế bởi ADR xxxx**.
- Sau khi **Đã chấp nhận**, không sửa nội dung. Đổi quyết định thì viết ADR mới có dòng "Thay thế ADR xxxx" và đổi trạng thái ADR cũ (R-07).
- Người quyết viết hoặc duyệt ADR (`docs/CHANGE-MANAGEMENT.md` mục 4). Coding agent chỉ soạn nháp khi được yêu cầu.

## Mẫu

```markdown
# ADR NNNN — <Tên quyết định>

| | |
|---|---|
| Trạng thái | Đề xuất |
| Ngày | YYYY-MM-DD |
| Người quyết | |
| Thay thế | — |

## Bối cảnh
Vấn đề, ràng buộc, điều buộc phải quyết bây giờ.

## Quyết định
Chọn gì, phát biểu ngắn, kiểm chứng được.

## Phương án đã cân nhắc
| Phương án | Được | Mất |
|---|---|---|

## Hệ quả
Dễ hơn, khó hơn, việc phải làm theo, rủi ro.
```

## Danh sách

| Số | Tên | Trạng thái | Ngày |
|---|---|---|---|
| 0001 | [Stack: Next.js, FastAPI, PostgreSQL trên Vercel, Render, Supabase](0001-stack-nextjs-fastapi-postgres.md) | Đã chấp nhận | 2026-11-27 |
| 0002 | [Chỉ nhóm trưởng sửa plan, qua đề xuất và bỏ phiếu](0002-chi-nhom-truong-sua-plan-qua-de-xuat.md) | Đã chấp nhận; một phần thay bởi 0004 | 2026-11-27 |
| 0003 | [Lõi agent Roa dùng chung với khung BTC](0003-loi-agent-dung-chung-voi-khung-btc.md) | Đề xuất | 2026-11-27 |
| 0004 | [Phiếu chỉ để ghi nhận, nhóm trưởng quyết áp dụng; v1 do nhóm trưởng duyệt](0004-phieu-de-ghi-nhan-nhom-truong-quyet.md) | Đã chấp nhận | 2026-11-27 |

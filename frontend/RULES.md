# Frontend Rules (`frontend/`)

Quy tắc bắt buộc cho phần frontend của **Partaway**. Kế thừa quy tắc chung từ [`../docs/PROJECT-RULES.md`](../docs/PROJECT-RULES.md).

## Quy tắc Frontend (R-40 – R-44)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-40 | Phải | Mọi lần gọi backend đi qua `frontend/lib/api.ts`; kiểu dữ liệu khớp `../docs/API_SPEC.md`. |
| R-41 | Phải | Frontend không tự tính tổng chi phí, số phiếu, ngưỡng, trạng thái đề xuất; hiện đúng số backend trả. |
| R-42 | Phải | Nút chỉ nhóm trưởng dùng được (sửa, gửi đề xuất, rút, xử lý góp ý) ẩn với thành viên theo `me.role`. |
| R-43 | Nên | Mọi thao tác gọi backend có trạng thái đang tải và thông báo lỗi bằng `error.message`. |
| R-44 | Nên | Giao diện dùng được trên điện thoại (màn hình 375px). |

## Quy tắc giao diện & thiết kế

- Mọi màu sắc, phân cấp hành động và nguyên tắc UI tuân theo [`DESIGN.md`](DESIGN.md) (NomadKit Design System).
- Bo góc của mọi nút bấm (`button` và CTA link dạng nút) chỉ dùng `5px` (`rounded-[5px]`).
- Đặc tả màn hình, luồng điều hướng và tiêu chí nghiệm thu xem tại [`docs/frontend-screens.md`](docs/frontend-screens.md).
- Chỉ dùng `NEXT_PUBLIC_API_BASE_URL` ở frontend; tuyệt đối không chứa key Google hay key LLM (`R-23`).

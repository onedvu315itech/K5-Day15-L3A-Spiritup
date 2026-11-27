# docs/features — Spec tính năng

Mỗi tính năng một file `<mo-ta-khong-dau>.md`, viết theo [`_TEMPLATE.md`](_TEMPLATE.md) **trước khi** viết code (R-01). Danh sách và trạng thái: [`../FEATURE-LIST.md`](../FEATURE-LIST.md).

## Vòng đời spec

| Trạng thái | Nghĩa | Ai đổi |
|---|---|---|
| Nháp | Đang viết, còn câu hỏi | Người phụ trách |
| Sẵn sàng | Đủ tiêu chí nghiệm thu, không còn câu hỏi chặn phần sẽ làm | Người phụ trách, đội trưởng xem |
| Đang làm | Có nhánh đang làm | Người làm |
| Xong | Mọi AC qua, PR đã merge | Người làm |
| Hoãn | Không làm trong hackathon | Đội trưởng |

## Viết spec tốt

- Quy tắc nghiệp vụ (BR) phát biểu kiểm chứng được: "đề xuất có ≥ `floor(n/2)+1` phiếu đồng ý thì hiện 'Đạt đa số'", không phải "đủ phiếu thì hiện đạt".
- Tiêu chí nghiệm thu dạng Given / When / Then; mỗi AC ghi cách kiểm (T = test tự động, E = kiểm tay / demo).
- Chỗ chưa biết thì ghi `[NEEDS CLARIFICATION: OQ-xx]` và thêm câu hỏi vào `docs/OPEN-QUESTIONS.md`, không đoán.
- Không chép lại bảng, endpoint: dẫn tới `docs/DATABASE.md`, `docs/API_SPEC.md`.

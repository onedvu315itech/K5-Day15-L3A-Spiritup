# Tóm tắt mô phỏng simulate-2@20261128-205111

Do `python run.py simulate` sinh ra — không sửa tay. Chép bảng sang `cost/cost-estimate.md`.

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| dung_it | 38 | 1 | 1056 | 238 | 1.7 | 10.4 |
| dung_vua | 10 | 2 | 1802 | 406 | 3.2 | 16.5 |
| dung_nhieu | 2 | 4 | 4652 | 1172 | 7.0 | 45.5 |

Tỉ lệ đạt dùng để tính: 24/24 (100%) — lượt run-6@20261128-140113

- Tỉ lệ đạt lấy từ lượt nhóm chọn: eval/run-6.csv (--rate-from).

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | Chi phí / tháng — thấp (300 người) | Chi phí / tháng — cơ sở (700 người) | Chi phí / tháng — cao (1.000 người) | Chi phí / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.00080 | $0.00080 | $0.00061 | $0.0999 | $0.2331 | $0.3330 | $0.00033 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.0043 | $0.0043 | $0.0033 | $0.5407 | $1.26 | $1.80 | $0.0018 |

- Chi phí / task thành công = chi phí / phiên ÷ tỉ lệ đạt. Chi phí / câu hỏi đạt = chi phí / phiên ÷ số lượt hỏi trung bình mỗi phiên (1.3) ÷ tỉ lệ đạt — tỉ lệ đạt đo theo từng câu thử.
- Token đo trên model: gpt-4o-mini. Giá tính theo từng model trong bảng — model khác bộ tách token thì số token thật có thể lệch; ghi rõ "đo trên model X, tính giá model Y" trong cost/cost-estimate.md.
- Phiên lỗi (không tính vào trung bình): 0/50.

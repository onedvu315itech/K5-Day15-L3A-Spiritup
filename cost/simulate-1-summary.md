# Tóm tắt mô phỏng simulate-1@20261128-142340

Do `python run.py simulate` sinh ra — không sửa tay. Chép bảng sang `cost/cost-estimate.md`.

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| dung_it | 24 | 1 | 2775 | 5026 | 1.5 | 8.3 |
| dung_vua | 12 | 3 | 8950 | 13626 | 4.6 | 27.6 |
| dung_nhieu | 14 | 5 | 14501 | 23389 | 7.8 | 43.2 |

Tỉ lệ đạt dùng để tính: 24/24 (100%) — lượt run-5@20261128-135617

- Tỉ lệ đạt lấy từ lượt nhóm chọn: eval/run-5.csv (--rate-from).

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | Chi phí / tháng — thấp (300 người) | Chi phí / tháng — cơ sở (700 người) | Chi phí / tháng — cao (1.000 người) | Chi phí / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.0202 | $0.0202 | $0.0078 | $71.80 | $167.53 | $239.33 | $0.2393 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.1030 | $0.1030 | $0.0396 | $365.78 | $853.48 | $1,219.25 | $1.22 |

- Chi phí / task thành công = chi phí / phiên ÷ tỉ lệ đạt. Chi phí / câu hỏi đạt = chi phí / phiên ÷ số lượt hỏi trung bình mỗi phiên (2.6) ÷ tỉ lệ đạt — tỉ lệ đạt đo theo từng câu thử.
- Token đo trên model: gemini-3.8-flash. Giá tính theo từng model trong bảng — model khác bộ tách token thì số token thật có thể lệch; ghi rõ "đo trên model X, tính giá model Y" trong cost/cost-estimate.md.
- Phiên lỗi (không tính vào trung bình): 0/50.

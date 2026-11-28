# Chi phí khi dùng thật

> Điền ở guide bước 4.2, nộp ở CP4 14:30 Thứ Bảy 28/11 (cập nhật `simulate-2` trước 23:59 sau khi chuẩn hoá `personas.yaml` theo khảo sát). Chấm ở rubric R6.
> Số **không điền tay**: điền `cost/personas.yaml` → `python run.py simulate --rate-from eval/run-6.csv` → chép bảng trong `cost/simulate-2-summary.md` vào đây.

## 1. Đầu vào

- **Persona** (`cost/personas.yaml`): 3 kiểu dựa trên khảo sát `evidence/survey/results.csv` (`n = 43` người dùng mục tiêu, Q2 & Q8):
  - `dung_it` (72%): `0,2` phiên/tháng, `1` lượt hỏi/phiên (`31/43` đi 1–2 chuyến/năm).
  - `dung_vua` (23%): `0,4` phiên/tháng, `2` lượt hỏi/phiên (`10/43` đi 3–5 chuyến/năm; `65,1%` sửa lịch 1–2 lần/chuyến).
  - `dung_nhieu` (5%): `1,0` phiên/tháng, `4` lượt hỏi/phiên (`2/43` đi ≥6 chuyến/năm; `11,6%` sửa ≥3 lần/chuyến).
- **Số người dùng thật**, 3 kịch bản: thấp **300** · cơ sở **700** · cao **1.000** *(tự ước tính cho tập khách du lịch tự túc tại Việt Nam trong giai đoạn đầu)*.
- **Giá**, 2 mức model, lấy từ `original-guide/further-reading/model-prices.md` (tra trang giá Google ngày 25/11/2026, https://ai.google.dev/gemini-api/docs/pricing):
  - `gemini-3.1-flash-lite` (Nhỏ): vào `$0.25` · ra `$1.50` / 1M token
  - `gemini-4-hydrogen` (Lớn): vào `$1.50` · ra `$7.50` / 1M token (bằng giá `gemini-3.8-flash` từ 01/01/2027)
- **Tỉ lệ đạt dùng để tính:** `24/24` (`100%`), lượt `run-6@20261128-140113` (`gpt-4o-mini`, Lượt 2 CP4).
- **Đo token trên model `gpt-4o-mini`, tính giá model `gemini-3.1-flash-lite` và `gemini-4-hydrogen`.** *(Nếu dùng đúng giá `gpt-4o-mini` trong `model-prices.md`: vào `$0.15` · ra `$0.60`/1M, chi phí còn thấp hơn `flash-lite`.)*

## 2. Kết quả mô phỏng (`simulate-2`)

Lượt mô phỏng chính thức (theo khảo sát): `cost/simulate-2.csv` · run ID `simulate-2@20261128-205111` · `50` phiên (`0` phiên lỗi) · seed `42`

*(chép nguyên từ `cost/simulate-2-summary.md`)*

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| dung_it | 38 | 1 | 1056 | 238 | 1.7 | 10.4 |
| dung_vua | 10 | 2 | 1802 | 406 | 3.2 | 16.5 |
| dung_nhieu | 2 | 4 | 4652 | 1172 | 7.0 | 45.5 |

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | / tháng — thấp (300) | / tháng — cơ sở (700) | / tháng — cao (1.000) | / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.00080 | $0.00080 | $0.00061 | $0.0999 | $0.2331 | $0.3330 | $0.00033 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.0043 | $0.0043 | $0.0033 | $0.5407 | $1.26 | $1.80 | $0.0018 |

*(Ghi chú lịch sử: lượt `simulate-1@20261128-142340` nộp lúc CP4 chạy trên `gemini-3.8-flash` với tần suất mẫu BTC 4–20 phiên/tháng cho cận trên `$0.0202`–`$0.1030`/task và `$167.53`–`$853.48`/tháng ở kịch bản cơ sở.)*

## 3. So với impact

- **Impact / người / tháng** (`spec.md` §2): **~30 phút/người/tháng** tiết kiệm cho nhóm trưởng (khảo sát Q2, Q5), chưa tính thời gian tìm quán thay gấp khi gặp quán đóng cửa (34,9%).
- **Chi phí / người / tháng** (cơ sở, `simulate-2`): **$0.00033** (`gemini-3.1-flash-lite`) đến **$0.0018** (`gemini-4-hydrogen`).
- **Kết luận một dòng — đáng làm không:** **Rất đáng làm** — chỉ tốn dưới **$0.002/người/tháng** (~50đ/người/tháng) để tiết kiệm ~30 phút/người/tháng và giảm rủi ro gặp quán đóng cửa.

## 4. *(Muốn sâu hơn, không bắt buộc)*

- **Độ nhạy theo model:** Dùng `gemini-3.1-flash-lite` (hoặc `gpt-4o-mini` giá `$0.15 / $0.60`) rẻ hơn khoảng 5 lần so với `gemini-4-hydrogen` mà vẫn đạt `24/24` trên bộ câu thử (`run-6`).
- **Chi phí ngoài model:** Hosting Vercel, Render, Supabase và phí gọi API bản đồ (Geoapify / Google Places) chưa tính vào bảng token.

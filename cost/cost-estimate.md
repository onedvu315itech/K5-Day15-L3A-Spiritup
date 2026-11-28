# Chi phí khi dùng thật

> Điền ở guide bước 4.2, nộp ở CP4 14:30 Thứ Bảy 28/11. Ôn lại: ngày 13, ngày 1, ngày 14 · lab ngày 13, lab ngày 14. Chấm ở rubric R6.
> Số **không điền tay**: điền `cost/personas.yaml` → `python run.py simulate` → chép bảng trong `cost/simulate-N-summary.md` vào đây.
> Lúc build dùng gói miễn phí vẫn tính theo **giá gói trả phí** — đây là chi phí cho lúc đưa vào dùng thật.

## 1. Đầu vào

- **Persona** (`cost/personas.yaml`): 3 kiểu: `dung_it` (50%, 4 phiên/tháng, 1 lượt hỏi/phiên), `dung_vua` (30%, 10 phiên/tháng, 3 lượt), `dung_nhieu` (20%, 20 phiên/tháng, 5 lượt). Nguồn: **chưa có**. Số và nguồn trong file vẫn là phần "(ví dụ)" của khung BTC (xem mục 5).
- **Số người dùng thật**, 3 kịch bản: thấp **300** · cơ sở **700** · cao **1.000**. Nguồn: **chưa có**. File đang ghi nguồn của track A ("lớp L3 hơn 700 học viên"), không áp dụng cho track C (xem mục 5).
- **Giá**, 2 mức model, lấy từ `original-guide/further-reading/model-prices.md` (BTC tra trang giá Google ngày 25/11/2026, https://ai.google.dev/gemini-api/docs/pricing):
  - `gemini-3.1-flash-lite` (Nhỏ): vào $0.25 · ra $1.50 / 1M token
  - `gemini-4-hydrogen` (Lớn): vào $1.50 · ra $7.50 / 1M token. Đây cũng là giá của `gemini-3.8-flash` (model đo token) **từ 01/01/2027**, mức BTC yêu cầu dùng cho model có lịch tăng giá. Nên dòng này chính là chi phí của model nhóm đang chạy.
- **Tỉ lệ đạt dùng để tính:** 24/24 (100%), lượt `run-5@20261128-135617` (`gemini-3.8-flash`, agent của Lượt 2). Lượt 2 chính thức là `run-6` (`gpt-4o-mini`), cũng 24/24. Chọn run-5 vì cùng model với lần đo token. Hai lượt cùng tỉ lệ nên chi phí / task thành công không đổi.
- **Đo token trên model `gemini-3.8-flash`, tính giá model `gemini-3.1-flash-lite` và `gemini-4-hydrogen`.** Hai model cùng họ Gemini nên bộ tách token có thể giống nhau, nhưng nhóm chưa kiểm.

## 2. Kết quả mô phỏng

Lượt mô phỏng: `cost/simulate-1.csv` · run ID `simulate-1@20261128-142340` · 50 phiên (0 phiên lỗi) · seed 42

*(chép từ `cost/simulate-1-summary.md`)*

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| dung_it | 24 | 1 | 2775 | 5026 | 1.5 | 8.3 |
| dung_vua | 12 | 3 | 8950 | 13626 | 4.6 | 27.6 |
| dung_nhieu | 14 | 5 | 14501 | 23389 | 7.8 | 43.2 |

| Model | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | / tháng — thấp (300) | / tháng — cơ sở (700) | / tháng — cao (1.000) | / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-3.1-flash-lite (vào 0.25 · ra 1.5 $/1M) | $0.0202 | $0.0202 | $0.0078 | $71.80 | $167.53 | $239.33 | $0.2393 |
| gemini-4-hydrogen (vào 1.5 · ra 7.5 $/1M) | $0.1030 | $0.1030 | $0.0396 | $365.78 | $853.48 | $1,219.25 | $1.22 |

Chi phí / task thành công = chi phí trung bình mỗi phiên ÷ tỉ lệ đạt (100%), nên bằng chi phí / phiên. Không phải vì nhóm coi như đạt 100%: tỉ lệ đo được ở run-5 là 24/24. Tỉ lệ này đo trên chính bộ câu mà agent Lượt 2 được sửa theo (`eval/report.md` mục 4), nên với yêu cầu mới tỉ lệ thật có thể thấp hơn, và chi phí / task thành công sẽ cao hơn tương ứng.

Đọc bảng:

- **Token ra lớn hơn token vào ở mọi persona** (khoảng 1,5–1,8 lần). Theo `eval/report.md`, `gemini-3.8-flash` tính cả token suy nghĩ vào token ra *(suy từ trace, chưa kiểm tài liệu GWAI)*. Giá ra đắt gấp 5–6 lần giá vào, nên token ra chiếm khoảng 90% chi phí mỗi phiên *(tính từ bảng: flash-lite $0.0183 / $0.0202)*.
- Mỗi lượt hỏi tốn khoảng 1,5 lần gọi model và 8–9 lần gọi công cụ. Số gọi model thấp vì code điều phối luồng, model chỉ đọc yêu cầu và chọn mã điểm (`spec.md` §10).

## 3. So với impact

- **Impact / người / tháng** (`spec.md` §2): **~30 phút/người/tháng** tiết kiệm cho nhóm trưởng (0,25 chuyến/tháng × 120 phút chốt lịch, khảo sát Q2, Q5), chưa tính thời gian tìm quán thay gấp khi gặp quán đóng cửa (34,9%).
- **Chi phí / người / tháng** (cơ sở): **$0.24** (`gemini-3.1-flash-lite`) đến **$1.22** (`gemini-4-hydrogen`, bằng giá `gemini-3.8-flash` từ 01/2027).
- **Kết luận một dòng — đáng làm không:** **Đáng làm**: dưới $1.22/người/tháng để tiết kiệm khoảng 30 phút. Kết luận này còn chắc hơn nếu tần suất dùng thật thấp như khảo sát cho thấy (mục 5), vì chi phí sẽ giảm nhiều. Nhưng **con số tháng chưa nộp được** khi persona và số người dùng chưa có nguồn.

## 4. *(Muốn sâu hơn, không bắt buộc)*

- **Model rẻ hơn:** chuyển từ giá `gemini-3.8-flash`/`hydrogen` sang `gemini-3.1-flash-lite` giảm chi phí khoảng 5 lần ($0.1030 → $0.0202 / phiên). Lượt 2 (run-6) chạy `gpt-4o-mini` (vào $0.15 · ra $0.60 / 1M, `model-prices.md`) cũng đạt 24/24 và còn rẻ hơn flash-lite theo bảng giá. Muốn có số thì thêm model này vào `prices` và chạy lại `simulate`, nhưng token đo trên Gemini nên phải ghi rõ "đo trên X, tính giá Y".
- **Giảm token ra:** token ra chiếm khoảng 90% chi phí (mục 2). Tắt hoặc giới hạn phần suy nghĩ của model, hoặc giới hạn độ dài câu "Lý do chọn", là cần gạt có tác dụng lớn nhất. Chưa đo.
- **Cache:** ít tác dụng vì token vào chỉ chiếm khoảng 10% chi phí.
- **Chi phí ngoài model:** hosting Vercel, Render, Supabase và Google Places/Routes (ADR 0001) chưa tính.

## 5. Còn thiếu trước khi nộp

Bảng ở mục 2 là kết quả thật của `simulate-1`, nhưng **ba dòng chi phí theo tháng dựa trên đầu vào chưa có nguồn**:

1. **Persona** vẫn là số mẫu của khung BTC (4 / 10 / 20 phiên/tháng, nguồn "(ví dụ) phỏng vấn P1, P3", "(ví dụ) khảo sát n = 24"). Khảo sát của nhóm (`evidence/survey/results.csv`, 47 phiếu) cho tần suất thấp hơn nhiều:
   - Q2: 33/47 đi 1–2 chuyến/năm, 10/47 đi 3–5 chuyến/năm, 2/47 đi 6 chuyến/năm trở lên, tức khoảng 0,1–0,4 chuyến/tháng.
   - Q1: 19/43 là nhóm trưởng tự lên lịch, 24/43 là thành viên.
   - Q8: 31/47 sửa lịch 1–2 lần trong chuyến, 5/47 sửa từ 3 lần trở lên.

   So với survey, 4–20 phiên/tháng làm chi phí tháng **cao hơn thực tế khoảng một bậc** *(tự ước tính)*. Bảng hiện tại là cận trên.
2. **Số người dùng** 300 / 700 / 1.000 đang ghi nguồn track A (học viên lớp L3), không đúng track C. Cần một nguồn công khai có link cho quy mô người dùng Partaway nhắm tới, hoặc ghi rõ *(tự ước tính)*.
3. **Nguồn giá** trong `personas.yaml` còn chữ "(ví dụ)". Số giá đã đúng với `model-prices.md`, chỉ cần sửa dòng nguồn.

Sửa xong `cost/personas.yaml` thì chạy `python run.py simulate --rate-from eval/run-5.csv` → `simulate-2`, rồi chép bảng mới vào mục 2 và cập nhật mục 3.

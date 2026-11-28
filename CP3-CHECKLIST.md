# Checklist hoàn thành CP3 — Nhóm Spiritup (Track C · Partaway / Roa)

> **Hạn nộp CP3:** **10:00 Thứ Bảy 28/11/2026** (4 điểm)  
> **Nộp tại:** https://ai20k-hackathon.pages.dev/#submit (Đội trưởng: `Vũ Lê Đức` · `2A202603683`)

---

## 1. Bảng việc cần làm trước 10:00 sáng

| # | Hạng mục | Trạng thái | Người phụ trách gợi ý | Việc cụ thể |
|---|---|---|---|---|
| 1 | **Bằng chứng pain (`evidence/summary.md`)** | ☑ **Đạt ngưỡng** | Đức / Cả nhóm | Đã có `47` phiếu khảo sát (`43` đúng người dùng, `5` trích dẫn). *(Tuỳ chọn: làm thêm `evidence/data-mining.md` từ review công khai để lấy thêm +3đ kiểm chéo ở R1.)* |
| 2 | **Nối AI thật (`codebase/ai.py`)** | ☑ **Đã xong** | Toàn | Đã nối Gemini REST API + OpenRouter vào `codebase/ai.py` và chạy `eval --try` có `tokens_in > 0`, `tokens_out > 0`. |
| 3 | **Hoàn thiện bản chạy thử (`codebase/tools.py`, `agent.py`)** | ☑ **Đã xong** | Toàn / Khương | Hoàn thiện 8 công cụ + kho `places_vn.json` (66 điểm, 5 thành phố) + `trending_spots.json` (12 điểm) + vòng lặp `MAX_STEPS=5` và chặn `check_itinerary` (`15/15` unit test OK). |
| 4 | **Mở rộng bộ câu thử (`eval/benchmark.csv`)** | ☑ **Đã xong** | Toàn / Đức | Mở rộng từ `12` → `24` câu (`thuong 11`, `kho 9`, `tu_choi 4`, `12/24 = 50%` nguồn thật). `python run.py check` không còn cảnh báo. |
| 5 | **Chạy Eval Lượt 1 & Chấm điểm (`eval/run-1.csv`)** | ☑ **Đã chạy** | Cả nhóm | Đã chạy `eval/run-1.csv` (`4/24`, bị `429`), `eval/run-2.csv` (`11/24 = 46%`, đủ 24/24 câu không lỗi API với `openai/gpt-4o-mini`, `tu_choi 4/4`), và `eval/run-3.csv` sau vá JSON mode (hết credit `HTTP 402` từ `B03`). |
| 6 | **Chạy thử mô phỏng chi phí** | ☑ **Đã xong** | Toàn / Khương | Đã chạy `python run.py simulate --try --wait 2` (`simulate-try@20261128-035246`, `openai/gpt-4o-mini`): **10/10 phiên thành công (`0/10` lỗi)** → `cost/simulate-try.csv` & `cost/simulate-try-summary.md`. |
| 7 | **Quay video demo 30 giây** | ☐ Chưa xong | Phúc / Đức | Quay **30 giây** thao tác thật với AI thật trả lời. Up lên YouTube (*Không công khai*) hoặc Google Drive (*Bất kỳ ai có đường liên kết*). Mở thử bằng **cửa sổ ẩn danh**. |
| 8 | **Cập nhật `data/DATA_CARD.md` & `spec.md` §10** | ☑ **Đã xong** | Đức / Toàn | Đã cập nhật `data/DATA_CARD.md` (66 điểm, 12 quán hot, 24 câu benchmark) và `spec.md` §7, §10. |
| 9 | **Push lên `main` & Nộp CP3** | ☐ Chưa xong | Đức | Kiểm tra `git status` không có `.env`, merge/push tất cả lên **`main`**, kiểm tra repo mở được ở cửa sổ ẩn danh rồi nộp form CP3 trước **10:00**. |

---

## 2. Lệnh kiểm tra nhanh

```bash
python run.py                  # Chạy thử bản tương tác với AI thật
python run.py check            # Kiểm benchmark.csv (20-30 câu), metric_spec.yaml, TEAMS.md
python run.py eval --try       # Chạy thử 3 câu đầu kiểm tra token > 0
python run.py eval             # Chạy cả bộ -> eval/run-1.csv + traces/run-1.jsonl
python run.py score eval/run-1.csv   # Tính % đạt sau khi điền cột pass (1/0)
python run.py simulate --try   # Thử mô phỏng chi phí 10 phiên
```

---

## 3. Luật cứng (KHÔNG được vi phạm)

- **KHÔNG** sửa `spec.md` §7 (chuẩn "đạt") và `eval/metric_spec.yaml` đã chốt ở CP2.
- **KHÔNG** xoá câu thử bị trượt hoặc sửa `expected` cho khớp output của model.
- **KHÔNG** commit `.env`, API key, hoặc file khảo sát gốc có SĐT/email.
- Lượt 1 điểm thấp là **bình thường** — ghi số thật vẫn đủ điểm; nhóm sẽ tối ưu lỗi chính cho Lượt 2 (CP4).

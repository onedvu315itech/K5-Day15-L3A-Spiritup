# Báo cáo đánh giá — lượt 1 → một cải tiến → lượt 2

> Điền ở guide bước 4.1. Lượt 1 trước **CP3 10:00 Thứ Bảy 28/11**, lượt 2 trước **CP4 14:30 Thứ Bảy 28/11**, cùng bộ câu thử, cùng cách chấm. Chấm ở rubric R5.
> Số lấy từ `python run.py score eval/run-1.csv` (và `run-2.csv`) sau khi điền cột `pass`. **Kết quả thấp ghi thật vẫn đủ điểm.**
> Không được: sửa chuẩn "đạt", bỏ câu thử trượt, sửa `expected` cho khớp output, sửa kết quả lượt đã chạy.

## 1. Kết quả

Đã chạy lượt 1 trên đủ 24 câu (`eval/run-1.csv`, `traces/run-1.jsonl`) với `gemini-3.5-flash`. Trong đó **4 câu hoàn thành (`B01`, `B02`, `B03`, `B11`) đều đạt `4/4`**, còn **20 câu gặp lỗi kỹ thuật `HTTP 429` (vượt quota API)** nên tính `0` trong lượt 1 theo số thật ghi được.

| Lượt | Run ID | Đạt / tổng | % | thuong | kho | tu_choi | So với chuẩn "đạt" |
|---|---|---|---|---|---|---|---|
| 1 | `run-1@20261128-033425` | `4/24` | `17%` | `3/11` (`27%`) | `0/9` (`0%`) | `1/4` (`25%`) | chưa *(20/24 câu lỗi `HTTP 429`)* |
| 2 | *(chờ lượt 2)* | __/__ | | __/__ | __/__ | __/__ | đạt / chưa |

Kết quả từng câu: `eval/run-1.csv`, `eval/run-2.csv`. Trace: `traces/run-1.jsonl`, `traces/run-2.jsonl`.

## 2. Chẩn đoán chạy thử kỹ thuật (`eval/run-try.csv`) & Đối chiếu `B01`

- **Kiểm tra offline với model `fake` (28/11/2026):** chạy hết 12/12 câu (bản CP2) để kiểm tra luồng gọi hàm không lỗi (`eval/run-fake.csv`).
- **Chạy thử `run-try@20261128-031142` (`gemini-3-flash-preview`):** `B01` hoàn thành (`5` gọi model, `21` gọi công cụ, `27.155` token vào / `7.661` token ra), `B02` và `B03` gặp `HTTP 429`. Qua đối chiếu trace `B01`, phát hiện lỗi quy trình: model bỏ bớt `DL-08` ở bước cuối mà chưa gọi lại `check_itinerary` (đã vá chặn trong `codebase/agent.py` kèm test offline trong `tests/test_agent.py`).

## 3. Lỗi lượt 1 — gom thành nhóm có tên

| Nhóm lỗi | Số câu | Câu |
|---|---|---|
| Lỗi kỹ thuật `HTTP 429` vượt quota API (`gemini-3.5-flash`) | 20 | `B04`–`B10`, `B12`–`B24` |

**Ví dụ cụ thể:**

| Câu | Input | Output | Vì sao sai |
|---|---|---|---|
| `B04` | Xếp lịch ăn tối và cafe buổi tối Đà Lạt 18:00–21:30 | *(rỗng — `RuntimeError: HTTP 429`)* | Bị chặn ngay lần gọi model đầu do vượt quota API miễn phí |
| `B05` | Lịch Đà Lạt 1 ngày có 1 bạn ăn chay | *(rỗng ở bước cuối — `RuntimeError: HTTP 429`)* | Chạy được 3 lần gọi model, 8 lần gọi công cụ rồi chạm giới hạn `429` |
| `B09` | Nhóm 10 người xung đột ngân sách 150k vs 500k | *(rỗng ở bước 3 — `RuntimeError: HTTP 429`)* | Chạy được 2 lần gọi model, 2 lần gọi công cụ rồi chạm giới hạn `429` |

## 4. Một lần cải tiến *(đã thêm hỗ trợ OpenRouter để chạy lượt 2)*

- Nhắm vào nhóm lỗi: **Giới hạn quota `HTTP 429` trên Gemini free tier** — vì sao là nhóm **đau nhất với người dùng**: người dùng/hệ thống không nhận được kết quả dù logic agent đã chạy đúng 4/4 câu không lỗi (`B01`, `B02`, `B03`, `B11`).
- Đã sửa gì: Bổ sung nhánh `MODEL_PROVIDER == "openrouter"` trong `codebase/ai.py` để chuyển sang OpenRouter API (tương thích OpenAI Chat Completions) trước khi chạy lượt 2.
- Kết quả: *(chờ chạy `python run.py eval` lượt 2 sau khi đổi `.env` sang `MODEL_PROVIDER=openrouter`)*

## 5. Còn lại

- Lỗi chưa sửa + nguy hiểm thế nào: Chưa chạy xong lượt 2 và `simulate` trên 100% câu không lỗi `429`.
- Nếu có thêm 1 tuần: Chạy đủ lượt 2 bằng OpenRouter trên toàn bộ 24 câu, chấm độc lập 2 người theo `eval/metric_spec.yaml`, và hoàn tất mô phỏng chi phí ≥50 phiên.

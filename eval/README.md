# Hồ sơ đánh giá — một trang

> Điền ở guide bước 2.4 (mục 1–4, trước CP2) và 4.1 (mục 5–6, trước CP4). Ôn lại: ngày 9, ngày 14 · lab ngày 9. Chấm ở rubric R4, R5.
> Người ngoài nhóm đọc trang này phải hiểu được: nhóm đo cái gì, bằng gì, ra số nào. Trang slide "Đánh giá thế nào" lấy từ đây.

## 1. Dataset → xử lý

Tại CP2, hệ thống dùng bộ dữ liệu địa điểm Đà Lạt mẫu có cấu trúc (`MOCK_PLACES` gồm 8 điểm `DL-01`–`DL-08` trong `codebase/tools.py`) để kiểm thử luồng agent và tính toán giờ mở cửa, thời gian di chuyển, ngân sách bằng code; đồng thời đã tích hợp sẵn module `codebase/osm_places.py` (OpenStreetMap) và đang chuẩn bị kho quán hot thu trước (`trending_spots`) để thay thế dữ liệu thật ở CP3. Bằng chứng người dùng lấy từ khảo sát `evidence/survey/results.csv` (`n = 43` người dùng mục tiêu đã ẩn danh), chi tiết tại `data/DATA_CARD.md`.

## 2. Bộ câu thử dựng ra sao

- `eval/benchmark.csv`: 12 câu (`thuong` 5 · `kho` 5 · `tu_choi` 2, trong đó 2 câu tấn công)
- Nguồn (`python run.py check` in sẵn): `nguoi_dung` 4 (`S07`, `S09`, `S14`, `S38`) · `data_that` 0 · `tu_viet` 8 · `sinh_seed` 0 → từ người dùng / data thật 4/12 (đạt ≥1/3)
- Độ phủ — lưới input 3–5 chiều (guide 2.4 bước 5): (1) độ dài chuyến đi (1 buổi sáng/tối, 1 ngày, 2N1Đ), (2) quy mô nhóm (4–10 người), (3) ngân sách/người (từ bất khả thi 100k/2 ngày đến 2 triệu), (4) ràng buộc đặc biệt & mức độ rõ ràng (ăn chay, xung đột ngân sách, thiếu thông tin, thiếu dữ liệu ngoài Đà Lạt), (5) phạm vi & thẩm quyền (yêu cầu hợp lệ vs đòi tự lưu/đặt bàn/lộ prompt).
- Câu `kho` trỏ về 4 lớp chỗ khó (`spec.md` §5): lớp 1 (nguồn sự thật / thiếu dữ liệu thành phố ngoài Đà Lạt): `B08` · lớp 2 (mơ hồ / thiếu thông tin / mâu thuẫn nhóm): `B06`, `B09` · lớp 3 (ngoài phạm vi / tấn công): `B11`, `B12` · lớp 4 (đặc thù lĩnh vực — ngân sách bất khả thi, thời gian di chuyển/giờ mở cửa không kịp): `B07`, `B10`.

## 3. Metric và cách chấm

| Metric (`eval/metric_spec.yaml`) | Cách chấm | Ngưỡng |
|---|---|---|
| `khop_gio_mo_cua` | `code` | 100% câu `thuong` và câu `kho` có lịch được xếp |
| `dung_ngan_sach` | `code` | 100% câu `thuong` và câu `kho` |
| `khong_bia_du_lieu` | `nguoi` | 100% toàn bộ câu thử |
| `tu_choi_va_hoi_lai_dung` | `nguoi` | 100% câu `tu_choi` và câu thiếu thông tin |

- **Người thứ hai chấm thử:** *(chờ Khương chấm độc lập 5 output cùng Toàn sau khi có output lượt đầu)* → khớp __/5 *(cần ≥4/5; lệch thì viết lại định nghĩa)*
- LLM chấm (nếu có): không dùng LLM chấm ở phiên bản CP2 (chấm bằng `code` và `nguoi` theo `pass_criterion` rõ ràng).
- **Chuẩn "đạt"** (chép nguyên từ `spec.md` §7, chốt trước 19:30 Thứ Sáu 27/11): "Đạt khi ≥ 80% tổng câu qua, và 100% câu `tu_choi` (gồm 2 câu tấn công) qua + 100% câu có lịch được xếp không vi phạm giờ mở cửa hoặc vượt ngân sách"

## 4. Lệnh

`python run.py eval` → `eval/run-N.csv` + `traces/run-N.jsonl` · điền cột `pass` · `python run.py score eval/run-N.csv`

## 5. Đã chạy gì

| Lượt | Run ID | Model | Cấu hình (prompt / công cụ / thay đổi) | Đạt / tổng | % | Đạt chuẩn? |
|---|---|---|---|---|---|---|
| 1 | `run-1@20261128-033425` | `gemini-3.5-flash` | 24 câu, 8 công cụ, vòng lặp `MAX_STEPS=5` + chặn `check_itinerary` | `4/24` | `17%` | chưa *(20 câu lỗi `HTTP 429`)* |
| 2 | `run-2@20261128-034607` | `openai/gpt-4o-mini` | 24 câu chạy đủ không lỗi API; lộ 8 lỗi JSON thừa `}` ở `get_travel_time` | `11/24` | `46%` | chưa |
| 3 | `run-3@20261128-035701` | `openai/gpt-4o-mini` | Bật `json_object` trong `ai.py` + retry JSON lỗi & đệm di chuyển trong `agent.py` | `2/24` | `8%` | chưa *(21 câu lỗi `HTTP 402` hết credit)* |

Lượt chạy lại vì lỗi kỹ thuật, lượt sau CP4: ghi thêm dòng, không sửa dòng cũ.

## 6. Lỗi chính

Tóm 2–3 dòng từ `eval/report.md`: nhóm lỗi lớn nhất · đã sửa gì · còn lại gì.

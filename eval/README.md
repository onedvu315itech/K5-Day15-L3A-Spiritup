# Hồ sơ đánh giá — một trang

> Điền ở guide bước 2.4 (mục 1–4, trước CP2) và 4.1 (mục 5–6, trước CP4). Ôn lại: ngày 9, ngày 14 · lab ngày 9. Chấm ở rubric R4, R5.
> Người ngoài nhóm đọc trang này phải hiểu được: nhóm đo cái gì, bằng gì, ra số nào. Trang slide "Đánh giá thế nào" lấy từ đây.

## 1. Dataset → xử lý

Dữ liệu chính tại CP2 là địa điểm thật ở Đà Lạt từ OpenStreetMap (`codebase/osm_places.py` qua Overpass API / Nominatim fallback), đã lọc theo toạ độ, loại điểm (`restaurant`, `cafe`, `attraction`, `hotel`) và giữ nguyên `opening_hours=null` khi thiếu dữ liệu để tránh bịa giờ (R-36). Bộ câu thử `eval/benchmark.csv` gồm 12 câu tại CP2 (4 câu đối chiếu dữ liệu OSM thật, 8 câu nhóm tự viết theo 4 lớp chỗ khó), chi tiết tại `data/DATA_CARD.md`.

## 2. Bộ câu thử dựng ra sao

- `eval/benchmark.csv`: 12 câu (`thuong` 5 · `kho` 5 · `tu_choi` 2, trong đó 2 câu tấn công)
- Nguồn (`python run.py check` in sẵn): `nguoi_dung` 0 · `data_that` 4 · `tu_viet` 8 · `sinh_seed` 0 → từ người dùng / data thật 4/12 (đạt ≥1/3)
- Độ phủ — lưới input 3–5 chiều (guide 2.4 bước 5): (1) độ dài chuyến đi (từ 1 buổi tối, 1 ngày, 2N1Đ, 3N2Đ), (2) quy mô nhóm (4–10 người), (3) ngân sách/người (từ bất khả thi 100k/2 ngày đến 2.5 triệu), (4) mức độ rõ ràng của yêu cầu (đủ thông tin vs thiếu thông tin/mâu thuẫn sở thích), (5) phạm vi & thẩm quyền (yêu cầu hợp lệ vs đòi tự lưu/đặt bàn/lộ prompt).
- Câu `kho` trỏ về 4 lớp chỗ khó (`spec.md` §5): lớp 1 (nguồn sự thật / thiếu `opening_hours`): B08 · lớp 2 (mơ hồ / thiếu thông tin): B06, B09 · lớp 3 (ngoài phạm vi / tấn công): B11, B12 · lớp 4 (đặc thù lĩnh vực — ngân sách bất khả thi, thời gian di chuyển không kịp): B07, B10.

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
| 1 | | | | __/__ | | |
| 2 | | | | __/__ | | |

Lượt chạy lại vì lỗi kỹ thuật, lượt sau CP4: ghi thêm dòng, không sửa dòng cũ.

## 6. Lỗi chính

Tóm 2–3 dòng từ `eval/report.md`: nhóm lỗi lớn nhất · đã sửa gì · còn lại gì.

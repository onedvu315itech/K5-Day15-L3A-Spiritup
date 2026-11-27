# Data card — dữ liệu bản chạy thử dùng

> Điền ở guide bước 2.4 (bản đầu ở CP2, đủ ở CP3). Ôn lại: ngày 6 · lab ngày 6. Chấm ở rubric R4.
> Một trang. Mỗi dataset một mục. Dữ liệu chạy thử để trong thư mục `data/` này.
> Không commit nguyên tài liệu khoá, dữ liệu cá nhân thật hay nguyên file data BTC cấp — chỉ đoạn trích ngắn, bản viết lại, hoặc số đã tổng hợp.

## Dataset 1 · Địa điểm Đà Lạt từ OpenStreetMap (`osm_places`)

| | |
|---|---|
| Dùng để làm gì | Nguồn cho công cụ `search_places` trong `codebase/tools.py` (`codebase/osm_places.py`) để agent Roa tìm nhà hàng, quán cafe, điểm tham quan, khách sạn thật tại Đà Lạt. |
| Từ đâu | Dữ liệu công khai OpenStreetMap (OSM) truy vấn theo thời gian thực qua Overpass API (dự phòng Nominatim Search). |
| Xử lý những bước gì | Lọc theo `bbox` / bán kính quanh toạ độ `(lat, lng)` và tag (`amenity=restaurant|cafe`, `tourism=attraction|viewpoint|museum|hotel|guest_house`); loại bỏ điểm không có tên; chuẩn hoá trường `place_id`, `kind`, `opening_hours` (`null` nếu thiếu trên OSM, không tự điền giờ giả — R-36); cache bộ nhớ 3600 giây. |
| Số dòng / số đoạn | Truy vấn động theo khu vực (tối đa `limit=30` mỗi lần gọi công cụ của agent, `50` cho Map). |
| Phiên bản / ngày lấy | Truy vấn trực tiếp tại thời điểm chạy (bắt đầu tích hợp ngày 2026-11-27). |
| Nhãn | thật (dữ liệu mở OSM) |
| Giới hạn | Nhiều quán ăn/cafe nhỏ ở Việt Nam trên OSM bị thiếu `opening_hours` (`null`) hoặc thiếu giá tham khảo; cần kết hợp kho quán hot thu trước và quy tắc báo "chưa rõ" thay vì bịa. |

## Dataset 2 · Kho quán hot Đà Lạt (`trending_spots` — đang chuẩn bị cho CP3)

| | |
|---|---|
| Dùng để làm gì | Nguồn bổ sung địa điểm đang được quan tâm tại Đà Lạt và gợi ý khoảng giá/lý do chọn cho Roa (OQ-11). |
| Từ đâu | Nhóm tự thu tay thông tin công khai từ TikTok/Instagram về các quán/điểm ở Đà Lạt (dự kiến ~50 điểm trước CP3). |
| Xử lý những bước gì | Lọc bỏ toàn bộ thông tin cá nhân người đăng (tên, ảnh, tài khoản — R-50); nhóm tự viết `summary` ngắn gọn, không chép nguyên văn bài đăng (R-52); chuẩn hoá loại hình và khoảng giá. |
| Số dòng / số đoạn | 0 dòng trong repo tại CP2 (mục tiêu ~50 dòng trước CP3). |
| Phiên bản / ngày lấy | Dự kiến thu và chốt trước CP3 (2026-11-28). |
| Nhãn | thật *(thu công khai, ẩn danh)* |
| Giới hạn | Dữ liệu mang tính thời điểm trên mạng xã hội, thiên về quán check-in/cafe của giới trẻ; chưa có trong phiên bản CP2. |

## Dataset 3 · Bộ câu thử đánh giá (`eval/benchmark.csv`)

| | |
|---|---|
| Dùng để làm gì | Bộ câu thử đầu vào để đánh giá agent Roa (`python run.py eval`) qua 3 loại tình huống `thuong`, `kho`, `tu_choi`. |
| Từ đâu | 4 câu đối chiếu với dữ liệu thật OSM Đà Lạt (`data_that: osm_places Đà Lạt`) + 8 câu nhóm tự viết (`tu_viet`) dựa trên 4 lớp chỗ khó và 2 kịch bản tấn công (`spec.md` §5). |
| Xử lý những bước gì | Phân loại theo `type` (`thuong`: 5, `kho`: 5, `tu_choi`: 2) và gắn tiêu chí đạt kiểm chứng được (`pass_criterion`) khớp `eval/metric_spec.yaml`. |
| Số dòng / số đoạn | 12 câu tại CP2 (sẽ mở rộng lên 20–30 câu trước CP3). |
| Phiên bản / ngày lấy | v0.1 (CP2) — 2026-11-27. |
| Nhãn | `data_that` (4 câu) · `tu_viet` (8 câu) |
| Giới hạn | Tại CP2 chưa có câu trích trực tiếp từ log chat thật của người dùng cuối (`nguoi_dung`); sẽ bổ sung sau khi thu xong khảo sát/review ở `evidence/`. |

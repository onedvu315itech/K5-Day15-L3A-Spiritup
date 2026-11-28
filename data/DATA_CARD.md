# Data card — dữ liệu bản chạy thử dùng

> Điền ở guide bước 2.4 (bản đầu ở CP2, đủ ở CP3). Ôn lại: ngày 6 · lab ngày 6. Chấm ở rubric R4.
> Một trang. Mỗi dataset một mục. Dữ liệu chạy thử để trong thư mục `data/` này.
> Không commit nguyên tài liệu khoá, dữ liệu cá nhân thật hay nguyên file data BTC cấp — chỉ đoạn trích ngắn, bản viết lại, hoặc số đã tổng hợp.

## Dataset 1 · Dữ liệu khảo sát người dùng du lịch nhóm (`evidence/survey/results.csv`)

| | |
|---|---|
| Dùng để làm gì | Đo bằng chứng pain thực tế (`evidence/summary.md`), làm căn cứ định nghĩa metric (`eval/metric_spec.yaml`), và cung cấp ngữ cảnh thực tế cho các câu thử `nguoi_dung` trong `eval/benchmark.csv`. |
| Từ đâu | Form khảo sát do nhóm tạo, gửi người dùng ngoài nhóm điền (Google Form). |
| Xử lý những bước gì | Ẩn danh hoàn toàn (mã hoá thành `S01`–`S47`, không lưu tên/email); lọc đối tượng đúng người dùng mục tiêu đi du lịch nhóm ≥ 3 người (`n = 43/47`, loại 4 phiếu đi một mình/tour). |
| Số dòng / số đoạn | 47 phản hồi (43 phản hồi đúng người dùng mục tiêu). |
| Phiên bản / ngày lấy | 2026-11-27 (CP2). |
| Nhãn | thật |
| Giới hạn | Mẫu thiên về sinh viên/người trẻ hay đi du lịch tự túc; đang bổ sung nguồn đào review công khai (`evidence/data-mining.md`) để kiểm chéo trước CP3. |

## Dataset 2 · Kho địa điểm Đà Lạt cho bản chạy thử (`data/places/da-lat.json`)

| | |
|---|---|
| Dùng để làm gì | Nguồn cho các công cụ tra cứu của Roa trong `codebase/tools.py` (`search_places`, `get_trending_spots`, `get_opening_hours`, `get_travel_time`, `check_itinerary`). |
| Từ đâu | (1) Bộ mẫu CP2 `DL-01`–`DL-08` (nhóm tự đặt giờ, giá; nhãn `mau_cp2`), giữ nguyên vì bộ câu thử B01–B10 viết theo nó. (2) Danh mục OpenStreetMap qua Geoapify Places, tải ngày 2026-11-27 cho Đà Lạt (cafe, ăn uống, tham quan; nhãn `osm_geoapify`). File tải thô để ở `data/raw/` (không commit); kho dựng bằng `scripts/build_place_store.py`, không gọi mạng. |
| Xử lý những bước gì | Chuẩn hoá về `id`, `name`, `city`, `category`, `area`, `open_min`, `close_min` (phút từ 0h), `avg_price_vnd`, `vegetarian_friendly`, `is_hot`, `lat`, `lon`, `source`, `source_note`, `fetched_at`. Với OSM chỉ giữ nơi có tên, không có dấu hiệu đóng cửa và giờ mở cửa dạng một khung cho mọi ngày (`07:00-22:00`, `Mo-Su …`, `24/7`); dạng chia ca hay theo thứ bị bỏ để không đọc sai giờ. Không đoán giá: nơi OSM có `avg_price_vnd = null`; khu lấy từ "Phường …" trong địa chỉ. |
| Số dòng / số đoạn | 94 nơi: 8 mẫu CP2 (cafe 2, ăn 4, tham quan 2) + 86 từ OSM (cafe 39, ăn 43, tham quan 4). |
| Phiên bản / ngày lấy | v0.2 (CP3) — OSM tải 2026-11-27, kho dựng 2026-11-28. |
| Nhãn | `mau_cp2`: tự đặt *(không có nguồn; Roa ghi "chưa xác minh" khi dùng)* · `osm_geoapify`: thật, © OpenStreetMap contributors (ODbL), Powered by Geoapify — ghi công ở khoá `attribution` của file kho. |
| Giới hạn | Chỉ có Đà Lạt; thành phố khác Roa báo chưa có dữ liệu và trả khung `[Cần kiểm tra & điền tay]` (OQ-22). Nơi OSM chưa có giá nên khi nhóm nêu ngân sách Roa chỉ xếp nơi có giá; giờ OSM do người đóng góp, có thể cũ. Chưa có cột độ hot thật (đang chỉ từ bộ mẫu). Giá, giờ tra theo đợt bằng Tavily để sau CP3 (`docs/roa-agent-design.md` §3.1). |

## Dataset 3 · Kho quán hot Đà Lạt (`trending_spots` — chuẩn bị cho CP3)

| | |
|---|---|
| Dùng để làm gì | Bổ sung địa điểm đang được quan tâm tại Đà Lạt kèm chỉ số tương tác và tóm tắt ngắn cho công cụ `get_trending_spots` (OQ-11). |
| Từ đâu | Nhóm tự thu tay thông tin công khai từ TikTok/Instagram về các quán/điểm ở Đà Lạt (mục tiêu ~50 điểm trước CP3). |
| Xử lý những bước gì | Lọc bỏ toàn bộ thông tin cá nhân người đăng (tên, ảnh, tài khoản — R-50); nhóm tự viết `summary` ngắn gọn, không chép nguyên văn bài đăng (R-52). |
| Số dòng / số đoạn | Chưa tách thành file riêng tại CP2 (mục tiêu ~50 dòng trước CP3). |
| Phiên bản / ngày lấy | Dự kiến chốt trước CP3 (2026-11-28). |
| Nhãn | thật *(thu công khai, ẩn danh)* |
| Giới hạn | Thiên về quán check-in/cafe giới trẻ; mang tính thời điểm trên mạng xã hội. |

## Dataset 4 · Bộ câu thử đánh giá (`eval/benchmark.csv`)

| | |
|---|---|
| Dùng để làm gì | Bộ câu thử đầu vào để đánh giá agent Roa (`python run.py eval`) qua 3 loại `thuong`, `kho`, `tu_choi`. |
| Từ đâu | 4 câu xuất phát từ phản hồi khảo sát thật (`nguoi_dung`: `S07`, `S09`, `S14`, `S38`) + 8 câu nhóm tự viết (`tu_viet`) theo 4 lớp chỗ khó và 2 kịch bản tấn công (`spec.md` §5). |
| Xử lý những bước gì | Phân loại theo `type` (`thuong`: 5, `kho`: 5, `tu_choi`: 2) và gắn `pass_criterion` khớp `eval/metric_spec.yaml`. |
| Số dòng / số đoạn | 12 câu tại CP2 (mở rộng lên 20–30 câu trước CP3). |
| Phiên bản / ngày lấy | v0.2 (CP2) — 2026-11-27. |
| Nhãn | `nguoi_dung` (4 câu) · `tu_viet` (8 câu) |
| Giới hạn | Mới tập trung vào Đà Lạt (và 1 câu Phú Quốc kiểm tra thiếu dữ liệu); sẽ mở rộng thêm tỉnh/thành khác và câu từ review công khai ở CP3. |

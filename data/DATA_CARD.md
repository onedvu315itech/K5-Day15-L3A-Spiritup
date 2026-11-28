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

## Dataset 2a · Kho địa điểm Đà Lạt cho bản chạy thử (`data/places/da-lat.json`)

| | |
|---|---|
| Dùng để làm gì | Nguồn cho các công cụ tra cứu của Roa trong `codebase/tools.py` (`search_places`, `get_trending_spots`, `get_opening_hours`, `get_travel_time`, `check_itinerary`). |
| Từ đâu | (1) Bộ mẫu CP2 `DL-01`–`DL-08` (nhóm tự đặt giờ, giá; nhãn `mau_cp2`), giữ nguyên vì bộ câu thử B01–B10 viết theo nó. (2) Danh mục OpenStreetMap qua Geoapify Places, tải ngày 2026-11-27 cho Đà Lạt (cafe, ăn uống, tham quan; nhãn `osm_geoapify`). File tải thô để ở `data/raw/` (không commit); kho dựng bằng `scripts/build_place_store.py`, không gọi mạng. |
| Xử lý những bước gì | Chuẩn hoá về `id`, `name`, `city`, `category`, `area`, `open_min`, `close_min` (phút từ 0h), `avg_price_vnd`, `vegetarian_friendly`, `is_hot`, `lat`, `lon`, `source`, `source_note`, `fetched_at`. Với OSM chỉ giữ nơi có tên, không có dấu hiệu đóng cửa và giờ mở cửa dạng một khung cho mọi ngày (`07:00-22:00`, `Mo-Su …`, `24/7`); dạng chia ca hay theo thứ bị bỏ để không đọc sai giờ. Không đoán giá: nơi OSM có `avg_price_vnd = null`; khu lấy từ "Phường …" trong địa chỉ. |
| Số dòng / số đoạn | 94 nơi: 8 mẫu CP2 (cafe 2, ăn 4, tham quan 2) + 86 từ OSM (cafe 39, ăn 43, tham quan 4). |
| Phiên bản / ngày lấy | v0.2 (CP3) — OSM tải 2026-11-27, kho dựng 2026-11-28. |
| Nhãn | `mau_cp2`: tự đặt *(không có nguồn; Roa ghi "chưa xác minh" khi dùng)* · `osm_geoapify`: thật, © OpenStreetMap contributors (ODbL), Powered by Geoapify — ghi công ở khoá `attribution` của file kho. |
| Giới hạn | Kho này chỉ có Đà Lạt (Hà Nội, Đà Nẵng, TP.HCM, Huế lấy từ Dataset 2b); thành phố ngoài hai kho Roa báo chưa có dữ liệu và trả khung `[Cần kiểm tra & điền tay]` (OQ-22). Nơi OSM chưa có giá nên khi nhóm nêu ngân sách Roa chỉ xếp nơi có giá; giờ OSM do người đóng góp, có thể cũ. Chưa có cột độ hot thật (đang chỉ từ bộ mẫu). Giá, giờ tra theo đợt bằng Tavily để sau CP3 (`docs/roa-agent-design.md` §3.1). |

## Dataset 2b · Kho địa điểm sạch Tầng 1 đa thành phố Việt Nam (`data/places_vn.json`)

| | |
|---|---|
| Dùng để làm gì | Kho dữ liệu địa điểm sạch Tầng 1 cho các công cụ tra cứu của Roa (`search_places`, `get_opening_hours`, `get_travel_time`, `check_itinerary`), hỗ trợ xếp lịch trình chính, kiểm tra chay/mặn, tính khoảng cách toạ độ (`lat`/`lon`), và gợi ý ăn vặt/đặc sản (`snack`) vào khoảng trống. |
| Từ đâu | Kế thừa 8 điểm gốc Đà Lạt (`DL-01`–`DL-08` từ `MOCK_PLACES` ở CP2), đối chiếu thêm dữ liệu OpenStreetMap/Geoapify (`data/raw/geoapify-da-lat-*.json`), bảng vé niêm yết chính thức của các di tích/bảo tàng, và thông tin địa điểm thật đã kiểm chứng tại 5 thành phố: Đà Lạt, Hà Nội, Đà Nẵng, TP.HCM, Huế. |
| Xử lý những bước gì | Chuẩn hoá đủ 13 trường trên mọi bản ghi (`id`, `name`, `city`, `category` thuộc `food`/`snack`/`cafe`/`sightseeing`/`activity`, `area`, `lat`, `lon`, `open_hour`, `close_hour`, `avg_price_vnd`, `vegetarian_friendly`, `is_hot`, `source`). Điểm nào không chắc giờ mở cửa cố định hoặc mức giá cố định (chợ đêm, quán vỉa hè truyền thống, điểm mới thu từ mạng xã hội) giữ `null` thay vì tự đoán số (R-36). |
| Số dòng / số đoạn | 66 địa điểm tại 5 thành phố: Đà Lạt (15), Hà Nội (13), Đà Nẵng (13), TP.HCM (13), Huế (12); mỗi thành phố đều phủ đủ 5 nhóm gồm cả `snack` (2–3 điểm/thành phố) và lựa chọn ăn chay. |
| Phiên bản / ngày lấy | v1.0 (CP3) — 2026-11-28. |
| Nhãn | thật *(địa điểm, toạ độ, giá vé/thực đơn đối chiếu công khai; giữ `null` nơi chưa xác minh chắc chắn)* |
| Cách dùng cùng 2a | Công cụ nạp cả hai kho; trùng mã (`DL-01`–`DL-08`) thì bản ghi ở 2b thắng vì có toạ độ. Giờ `open_hour`/`close_hour` đổi sang phút khi nạp. |
| Giới hạn | Mỗi thành phố tuyển chọn 12–15 điểm tiêu biểu; chủ đích để các điểm đến khác (như Phú Quốc ở câu thử `B08`) ngoài kho Tầng 1 để kiểm chứng nhánh cảnh báo `[Cần kiểm tra & điền tay]` khi thiếu dữ liệu. |

## Dataset 3 · Kho quán hot đã làm sạch (`data/trending_spots.json`)

| | |
|---|---|
| Dùng để làm gì | Cung cấp danh sách quán/điểm check-in đang được quan tâm trên mạng xã hội kèm chỉ số tương tác (`engagement`) và tóm tắt ngắn cho công cụ `get_trending_spots` (OQ-11). |
| Từ đâu | Làm sạch từ tập ứng viên thu thử công khai trên TikTok cho Đà Lạt (`data/raw/tiktok-da-lat-20261127-170358.candidates.json` — 23 video ứng viên). |
| Xử lý những bước gì | Loại bỏ 11 video tổng hợp chung chung/lỗi không xác định được tên quán cụ thể; xoá toàn bộ khối `_review`, tên hiển thị, handle `@...`, hashtag cá nhân và link hồ sơ người đăng (chỉ giữ `https://www.tiktok.com/video/<id>` theo R-50); giữ nguyên số tương tác thu được hoặc `null` nếu không trích xuất được (không bịa số); nhóm tự viết mới câu `summary` ngắn gọn cho từng điểm, không chép nguyên văn caption (R-52); nối `place_id` sang `places_vn.json` với điểm trùng (`DL-15`). |
| Số dòng / số đoạn | 12 địa điểm đã làm sạch tại Đà Lạt (9 `cafe`, 2 `food`, 1 `sightseeing`). |
| Phiên bản / ngày lấy | v1.0 (CP3) — thu ngày 2026-11-27, làm sạch ngày 2026-11-28. |
| Nhãn | thật *(thu công khai, đã ẩn danh người đăng theo R-50 và viết lại tóm tắt theo R-52)* |
| Giới hạn | Đợt thu đầu mới phủ Đà Lạt và thiên về nhóm quán cà phê check-in giới trẻ; các thành phố chưa thu đợt riêng trên TikTok sẽ dùng cờ `is_hot` trong `data/places_vn.json` hoặc báo rõ chưa có kho `trending_spots` riêng. |

## Dataset 4 · Bộ câu thử đánh giá (`eval/benchmark.csv`)

| | |
|---|---|
| Dùng để làm gì | Bộ câu thử đầu vào để đánh giá agent Roa (`python run.py eval`) qua 3 loại `thuong`, `kho`, `tu_choi`. |
| Từ đâu | 11 câu xuất phát từ phản hồi khảo sát thật (`nguoi_dung`: `S02`, `S07`, `S09`, `S10`, `S14`, `S15`, `S19`, `S20`, `S26`, `S33`, `S38` trong `evidence/survey/results.csv`) + 1 câu từ dữ liệu thật thiếu giờ/giá (`data_that`: `data/trending_spots.json` + `data/places_vn.json`) + 12 câu nhóm tự viết (`tu_viet`) theo 4 lớp chỗ khó, lấp khoảng trống plan gốc và kịch bản tấn công (`spec.md` §5). |
| Xử lý những bước gì | Phân loại theo `type` (`thuong`: 11, `kho`: 9, `tu_choi`: 4) và gắn `pass_criterion` khớp `eval/metric_spec.yaml`; giữ nguyên toàn bộ 12 câu CP2 (`B01`–`B12`) và chỉ bổ sung 12 câu mới (`B13`–`B24`). |
| Số dòng / số đoạn | 24 câu tại CP3 (`thuong` 11 · `kho` 9 · `tu_choi` 4). |
| Phiên bản / ngày lấy | v1.0 (CP3) — 2026-11-28. |
| Nhãn | `nguoi_dung` (11 câu) · `data_that` (1 câu) · `tu_viet` (12 câu) — tổng nguồn thật `12/24` (`50,0%`, đạt `≥ 1/3`) |
| Giới hạn | Bộ câu thử bao phủ 5 thành phố có trong kho Tầng 1 (Đà Lạt, Hà Nội, Đà Nẵng, TP.HCM, Huế), các tình huống lấp khoảng trống plan gốc và thành phố ngoài kho (Phú Quốc, Nha Trang); kết quả chấm chất lượng trên bộ 24 câu vẫn chờ chạy `eval` với model thật khi có đủ quota. |

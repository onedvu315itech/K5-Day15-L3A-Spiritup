# Thiết kế agent Roa: dữ liệu, công cụ, luồng `generate`, cache

> **Bản nháp v0.3 (27/11/2026), chưa duyệt.** Đề xuất thay nguồn địa điểm Google bằng Geoapify và thiết kế luồng thu "quán hot". Khi được duyệt thì chuyển phần đã chốt vào `spec.md` §4, `ARCHITECTURE.md`, `docs/DATABASE.md` (mục 8) và người quyết ghi ADR. Các mục còn phải quyết ở mục 9; không tự chọn (R-02).

## 1. Nguồn dữ liệu

| Việc | Nguồn | Gọi lúc nào |
|---|---|---|
| Điểm đến → ranh giới, toạ độ | Geoapify Geocoding `GET /v1/geocode/search` (`type=city`, `filter=countrycode:vn`) | Lúc chạy, có cache |
| Danh sách địa điểm theo loại | Geoapify Places `GET /v2/places` (`filter=place:<id thành phố>`) | Lúc chạy, có cache |
| Giờ mở cửa, website | Geoapify Place Details `GET /v2/place-details` | Lúc chạy, chỉ cho ứng viên đã chọn, có cache |
| Thời gian, quãng đường | Geoapify Routing `GET /v1/routing` (`mode=scooter` / `drive` / `walk`) | Lúc chạy, có cache |
| Độ "hot" | TikTok (Tavily tìm, Firecrawl / RapidAPI lấy engagement) | **Thu trước theo đợt** vào kho `trending_spots` |

Theo trang docs và bảng giá Geoapify (xem ngày 27/11/2026):

- **Gói miễn phí:** 3.000 credit/ngày, tối đa 5 request/giây. Được dùng cho sản phẩm thương mại nếu ghi nguồn.
- **Credit:** Geocoding 1 credit/lần. Places 1 credit cho mỗi 20 nơi (con số lấy từ bản tóm tắt trang docs, chạy script để kiểm lại). Place Details 1 credit/nơi. Routing 1 credit/chặng.
- **Ghi nguồn bắt buộc:** "© OpenStreetMap contributors" và "Powered by Geoapify" (gói miễn phí), đặt gần chỗ hiện dữ liệu.
- **Lưu, cache kết quả:** điều khoản Geoapify không nhắc tới (mục 9, câu Q5). Dữ liệu gốc là OpenStreetMap, giấy phép ODbL; điều kiện của ODbL chưa đọc được trang gốc để kiểm.
- **Không có** điểm đánh giá, độ phổ biến, mức giá có cấu trúc. Kết quả xếp theo khoảng cách nếu có `bias=proximity`.

## 2. Dữ liệu thật: mẫu 20 nơi ở trung tâm Đà Lạt

Lấy từ lần gọi thử của Khương (`catering.restaurant,accommodation.hotel`, bán kính 2 km, `limit=20`):

| Trường | Có | Ghi chú |
|---|---|---|
| Tên | 19/20 | 1 khách sạn không có tên |
| Toạ độ, địa chỉ, loại | 20/20 | Địa chỉ nhiều nơi chỉ có tên đường, không có số nhà |
| Giờ mở cửa | 1/20 | Giá trị là "Till late", không đọc được thành giờ |
| Giá | 2/20 | Chỉ nằm trong mô tả tự do của 2 khách sạn ("Price: 860k-2800k VND") |
| Đánh giá, độ phổ biến | 0/20 | Geoapify không có |
| Dấu hiệu đã đóng cửa | 1/20 | Tên tiếng Nga của "Hương Trà" ghi là không còn hoạt động; trường trạng thái không có |

Hệ quả cho lát cắt "thoả giờ mở cửa và ngân sách":

1. **Giờ mở cửa thiếu gần hết.** `check_plan` không kiểm được giờ thật cho đa số nơi. Cần một nguồn bổ sung hoặc giờ mặc định có cảnh báo (Q2).
2. **Giá gần như không có.** Kiểm ngân sách phải dựa vào giá thu kèm trong kho, hoặc mức giá mặc định theo loại và ghi rõ là ước tính (Q3).
3. **Không biết nơi nào nổi tiếng.** Kết quả xếp theo khoảng cách, 20 nơi đầu đều trong bán kính 200 m và đa số là khách sạn nhỏ. Độ "hot" phải lấy từ kho TikTok.
4. **Dữ liệu OSM có thể cũ.** Quán mới mở (thường là quán hot trên TikTok) có thể chưa có trên OSM. Script `scripts/spike_google_places.py` cũ được thay bằng `scripts/spike_geoapify.py` để đo tỉ lệ quán TikTok tìm được trên Geoapify.

### 2.1. Các lần chạy `spike_geoapify.py` (Đà Lạt, 27/11/2026)

Lần 1 (khoảng 42 credit) chỉ lấy 100 nơi mỗi nhóm và khớp được 0/11 tên TikTok. Script đã sửa: lấy hết các trang, khớp tên trên danh mục đã tải, thử `name=` với một tên có sẵn làm đối chứng, rồi thử Geocoding theo chữ. Lần 3 (khoảng 71 credit) lấy đủ danh mục trong ranh giới thành phố (lần 2 lỗi do OSM có nơi đặt tên là số, đã sửa):

| Nhóm | Số nơi | Có tên | Có giờ mở cửa | Giờ đọc được | Website | Giá |
|---|---|---|---|---|---|---|
| Cà phê | 297 (1 trang, hết) | 281 | 46 | 44 (≈15%) | 13 | 0 |
| Quán ăn | 432 (1 trang, hết) | 402 | 54 | 46 (≈11%) | 10 | 0 |
| Tham quan | 54 (hết) | 41 | 5 | 5 (≈9%) | 0 | 0 |

- **Cả 783 nơi có mã OSM**, nên gộp kho theo mã OSM (mục 3) dùng được.
- **Place Details không bù được giờ:** 3/15 nơi có giờ (lần 1). Details chỉ đọc lại cùng tag OSM.
- **Routing chạy được:** 2 chặng xe máy, quãng đường thật khoảng 1,7 lần đường chim bay.
- **`name=` của Places không dùng được:** tên đối chứng "Coffee One Day" có trong danh mục vẫn trả 0 kết quả. Docs không nói `name=` khớp kiểu gì.
- **Khớp tên TikTok sang Geoapify: 1/6** tên đủ riêng (5/11 tên là tên chung như "Bánh căn", "Foodtour", bị bỏ). Khớp được "Happy Hill" qua Geocoding (`result_type = amenity`, cách trung tâm 6,7 km), không có trong danh mục Places. Không thấy: Hidden Land, Hôm Nào, Miền Du Mục, Dốc Mơ, Lang Farm Center (danh mục chỉ có "Langfarm Buffet").
- **Nhóm tham quan thiếu nhiều nơi nổi tiếng.**
  - Có: Thung Lũng Tình Yêu, Thác Datanla, Hồ Tuyền Lâm, Dinh III Bảo Đại, Ga Đà Lạt, nhà thờ Camly.
  - Không có: Hồ Xuân Hương, Crazy House (Hằng Nga), Thiền viện Trúc Lâm, Chợ Đà Lạt, Quảng trường Lâm Viên, Domaine de Marie, chùa Linh Phước.
  - Lý do: 51/54 nơi mang loại `tourism.attraction`. Hồ, công viên, chùa, nhà thờ, chợ nằm ở các loại khác. Cần thêm loại vào nhóm `sight`, nhưng phải đối chiếu mã trong bảng categories của Geoapify trước, không đoán mã.

Hệ quả:

- Giờ mở cửa chỉ có ở khoảng 11–15% nơi. Q2 phải quyết trước CP3.
- Giá: 0% từ Geoapify. Q3 cũng vậy.
- OSM thiếu phần lớn quán hot trên TikTok (chỉ 1/6 khớp, và phải qua Geocoding). Chiều B cùng cách xử lý nơi không có trên OSM (mục 3) là bắt buộc, không phải phần phụ.
- Credit cho cả danh mục một thành phố cỡ Đà Lạt: khoảng 47 credit Places và 7 credit Geocoding. Chạy theo đợt mỗi điểm đến một lần là vừa gói miễn phí.

## 3. Luồng thu "độ hot": làm theo đợt, không làm lúc Roa chạy

Luồng nhóm đang nghĩ: lấy địa điểm từ Geoapify → tìm từng nơi trên TikTok → đánh giá có hot không → đề xuất. Đề xuất giữ luồng này nhưng **chạy theo đợt cho từng điểm đến**, ghi kết quả vào kho. Roa lúc chạy chỉ đọc kho. Lý do:

- **Đã chốt** "không crawl TikTok/Instagram lúc chạy" (`ARCHITECTURE.md` mục 5, `AGENTS.md` mục 7). Muốn đổi phải qua CR.
- **Chậm:** mỗi nơi cần 1 lần tìm Tavily và vài lần lấy trang video. Với 30–60 ứng viên, lượt `generate` sẽ thêm vài phút *(tự ước tính)*.
- **Tốn quota** Tavily, Firecrawl mỗi lần tạo chuyến đi, kể cả khi hai nhóm cùng đi một nơi.
- **Eval không lặp lại được:** kết quả TikTok đổi theo ngày, `run-1` và `run-2` không so sánh được.

Thu theo hai chiều, vì mỗi chiều bỏ sót một kiểu quán:

| Chiều | Cách làm | Bắt được | Bỏ sót |
|---|---|---|---|
| A. Geoapify → TikTok (luồng nhóm đang nghĩ) | Lấy nơi theo loại; chọn nơi có tên riêng đủ rõ (bỏ tên chung như "Pho nuong ngon", tên chuỗi có ≥ 2 chi nhánh trong danh mục, tên không phải chữ Latin, nơi có dấu hiệu đóng cửa); tìm "`<tên> <thành phố>`" trên TikTok, tên thành phố luôn ở cuối (vd "bùng binh chợ mới đà lạt"); chỉ tính video có tên nơi trong tiêu đề hoặc caption | Điểm tham quan, quán lâu năm có trên OSM | Quán mới chưa có trên OSM |
| B. TikTok → Geoapify (script cũ) | Tìm "quán cà phê đẹp `<thành phố>`", "quán ăn ngon… `<thành phố>`" (tên thành phố ở cuối); model tách tên quán từ tiêu đề, caption (một video có thể nêu nhiều quán); khớp tên đó với danh mục Geoapify đã tải của thành phố (bỏ dấu), không khớp thì Geocoding theo chữ. Không dùng `name=` (mục 2.1) | Quán đang hot, kể cả quán mới | Quán ít người quay |

Gộp hai chiều theo mã OSM (`n1152319302`), mỗi nơi một dòng kho:

- **Bằng chứng:** số video trong 6 tháng, lượt xem lớn nhất, tổng lượt lưu và chia sẻ, link video (không lưu tên, ảnh người đăng).
- **Mức hot** do code tính:
  - `hot`: có video ≥ 100.000 lượt xem, hoặc ≥ 3 video *(ngưỡng tự ước tính, chỉnh sau khi có dữ liệu)*.
  - `co_nhac`: có ít nhất 1 video.
  - Không có video thì nơi đó không vào kho.
- **Thu kèm nếu caption có:** khoảng giá ("giá 35k–50k"), giờ mở cửa. Ghi nguồn là link video. Đây là cách lấp lỗ giờ mở cửa và giá ở mục 2 (Q2, Q3).
- **Người duyệt** viết `summary` 1–2 câu, kiểm lại tên khớp đúng quán, rồi nạp kho.

Quán ở chiều B không tìm thấy trên Geoapify thì không có toạ độ để tính đường. Lần chạy đầu cho thấy đây có thể là phần lớn quán hot (mục 2.1), nên bỏ đi sẽ mất đúng phần nhóm cần. Thứ tự đề xuất: (1) Geocoding theo chữ "`<tên>, <thành phố>`"; (2) geocode địa chỉ trong caption; (3) người duyệt nhập toạ độ tay khi nạp kho, ghi nguồn. Dòng kho không có mã OSM thì dùng `ref = tt:<id nội bộ>`. Lần 3 (mục 2.1): 1/6 tên khớp được, và chỉ qua Geocoding (bước 1).

## 4. Công cụ của Roa

Mỗi công cụ một hàm `@tool` trong `codebase/tools.py`. Không có công cụ ghi plan (R-31).

| Công cụ | Vào | Ra | Nguồn |
|---|---|---|---|
| `search_places` | điểm đến, nhóm loại (`cafe` / `food` / `sight` / `hotel`), số nơi | `[{ref, name, kind, lat, lon, address, opening_hours?, cuisine?, maybe_closed}]`, kèm `city_ref` | Geocoding + Places, cache |
| `get_place_details` | `ref` | `opening_hours`, `website`, mô tả | Place Details, cache |
| `get_trending_spots` | `city_ref`, nhóm loại tuỳ chọn | `[{ref, name, kind, hot_level, evidence, price_hint?, hours_hint?, summary}]`, chỉ mục thu trong 6 tháng | Kho `trending_spots` (DB ở backend, file `data/` khi eval) |
| `get_travel_time` | danh sách điểm theo thứ tự, phương tiện | thời gian, quãng đường từng chặng | Routing, cache theo từng cặp điểm |
| `check_plan` | plan nháp, thông tin chuyến | vi phạm cứng, vi phạm mềm | Code, không gọi mạng |

- `ref` là mã OSM (`osm:n1152319302`), ổn định hơn `place_id` của Geoapify (chuỗi hex dài, có chứa toạ độ). Place Details nhận được cả `osm_id` + `osm_type`.
- Giờ mở cửa OSM có cú pháp riêng (`Mo-Su 07:00-22:00`). Cần một hàm đọc các dạng phổ biến; dạng không đọc được thì coi như chưa có giờ.
- Phương tiện: Routing có `scooter` (xe máy), hợp với nhóm đi xe máy thuê.

## 5. Luồng `generate`

```
B1  Hiểu yêu cầu (model)        → TripRequest: điểm đến, số ngày, ngày đi, số người,
                                   ngân sách/người, sở thích, nhịp đi, phương tiện
    Kiểm bằng code               → thiếu điểm đến / số ngày, hoặc ngoài Việt Nam: hỏi lại hoặc từ chối
B2  Xác định điểm đến (code)    → search_places geocode; mơ hồ (confidence thấp) thì hỏi lại
B3  Gom ứng viên (code, song song)
      search_places × 3–4 nhóm loại theo sở thích
      get_trending_spots(city_ref)
B4  Gộp, lọc, xếp hạng (code)   → nối theo ref; bỏ nơi không tên, maybe_closed;
                                   điểm = mức hot + khớp sở thích; gom theo khu (khoảng cách đường chim bay);
                                   giữ K ≈ 30 nơi, đặt mã c1…cK
B5  Bổ sung giờ (code)          → get_place_details cho ứng viên chưa có giờ (tối đa ~10 nơi)
B6  Chọn và xếp (model)         → mỗi ngày một danh sách mã c…, thời lượng gợi ý; chỉ được dùng mã đã cho
    Kiểm bằng code               → bỏ mã lạ; sai schema thì thử lại 1 lần (R-33)
B7  Tính giờ, tiền (code)       → get_travel_time từng ngày; giờ bắt đầu/kết thúc từng mục;
                                   chi phí từ price_hint hoặc mức mặc định (ghi là ước tính)
B8  check_plan (code)           → cứng: ngoài giờ mở cửa đã biết, chồng giờ, vượt ngân sách
                                   mềm: giờ chưa xác minh, đi xa, ngày quá dày
B9  Sửa 1 lần (model)           → nếu có vi phạm cứng: gửi danh sách vi phạm, model đổi mã/thứ tự; quay lại B7–B8
B10 Trả kết quả                 → còn vi phạm cứng: infeasible + lý do
                                   chỉ vi phạm mềm: plan nháp + cảnh báo (nêu rõ nơi nào giờ chưa xác minh)
```

- Model được gọi 2 lần, hoặc 3 lần nếu phải sửa. Mọi giờ, tiền, thời gian đi do code tính (`AGENTS.md` mục 8).
- `reason` của mỗi mục do code ghép từ dữ liệu (vd "đang hot trên TikTok: 3 video, 1,2 triệu lượt xem"), không để model tự viết số.
- Điểm đến không có trong kho: `get_trending_spots` trả rỗng, Roa vẫn xếp từ Geoapify và nói rõ "chưa có dữ liệu quán hot cho nơi này".
- `ask` dùng cùng công cụ đọc, trên plan hiện tại. Công cụ tìm web cho câu hỏi ngoài dữ liệu (thời tiết, sự kiện) là đề xuất riêng, chưa thêm (Q7).

## 6. Cache

Cache để giảm credit và để eval lặp lại được. Không cache câu trả lời của model.

| Cache | Khoá | Giá trị | Hạn đề xuất (OQ-12) |
|---|---|---|---|
| `geocode` | điểm đến đã chuẩn hoá (bỏ dấu, chữ thường) | `city_ref`, toạ độ, tỉnh | 90 ngày |
| `places` | `city_ref` + nhóm loại + `limit` | danh sách đã rút gọn (mục 4) | 14 ngày |
| `details` | `ref` | giờ mở cửa, website | 14 ngày |
| `route` | `ref` đi + `ref` đến + phương tiện | giây, mét | 30 ngày |
| Kho hot | `trending_spots` | mục 3 | thu lại theo đợt; chỉ dùng mục trong 6 tháng (đã có) |

- **Backend:** dùng bảng `places_cache` đã có (`key`, `kind`, `response`, `fetched_at`, `expires_at`), thêm `kind = geocode`. Hết hạn thì gọi lại và ghi đè.
- **`codebase/` khi chạy eval, không có DB:** cache file JSON trong `data/cache/` (git bỏ qua). Một lớp `Cache` có hai bản cài (file, DB), backend truyền bản DB vào. Công cụ không biết mình đang chạy ở đâu.
- **Eval lặp lại được:** chế độ `replay` chỉ đọc cache, thiếu thì báo lỗi thay vì gọi mạng. Muốn cả nhóm chạy cùng dữ liệu thì phải commit ảnh chụp cache cho các điểm đến trong bộ câu thử, việc này chờ Q5.
- Tính theo chuyến đi 3 ngày *(tự ước tính)*:
  - Chưa có cache: khoảng 1 + 15 (3 nhóm × 100 nơi) + 10 (details) + 30 (routing, cả lần sửa) ≈ 56 credit, tức khoảng 50 lần `generate`/ngày trên gói miễn phí.
  - Điểm đến đã có cache places, details: còn khoảng 30 credit.

## 7. Thu kho cho một điểm đến (chạy tay hoặc lệnh riêng)

1. `spike_geoapify.py --city X`: ranh giới, danh sách nơi, đo độ phủ dữ liệu.
2. Chiều B: `spike_tiktok_trending.py --city X` → model tách tên → khớp Geoapify (`spike_geoapify.py --candidates`).
3. Chiều A: `spike_tiktok_trending.py --city X --from-catalog <file geoapify> --top N`. Mỗi nơi 1 lượt Tavily; ra file `.catalog-hits.json` (mỗi nơi: số video tìm thấy, số video có nhắc tên, mã video) và gắn `catalog_refs` (mã OSM) vào dòng ứng viên. Với Đà Lạt có 605 nơi đủ điều kiện (33 tham quan, 236 cà phê, 336 quán ăn), nên phải chọn N (tối đa ~40 nơi mỗi điểm đến *(tự ước tính)*). Script xen kẽ các nhóm, ưu tiên nơi OSM có website hoặc giờ mở cửa (cách chọn tạm, chưa kiểm).
4. Gộp theo `ref`, tính mức hot, người duyệt viết `summary` và kiểm khớp tên.
5. Nạp vào `trending_spots`, ghi điểm đến và ngày thu vào `data/DATA_CARD.md`.

Hai script hiện tại làm bước 1, 2, 3 và phần khớp. Bước 4 (gộp, tính mức hot) chưa viết. Giới hạn đã biết của chiều A:

- Tên nơi trùng chữ thường (vd quán tên "bình thường") sẽ khớp nhầm caption; người duyệt phải kiểm.
- Lọc chuỗi theo số chi nhánh trong danh mục OSM; chuỗi chỉ có 1 chi nhánh trên OSM (vd Highlands Coffee ở Đà Lạt) vẫn lọt.
- Tavily chỉ trả đoạn mô tả ngắn, nên video có nhắc tên nhưng caption bị cắt sẽ không được tính.

## 8. Tài liệu phải sửa nếu duyệt

| Tài liệu | Sửa |
|---|---|
| ADR mới (người quyết viết) | Thay Google Places/Routes bằng Geoapify; ADR 0001 đang ghi Google |
| `ARCHITECTURE.md` mục 3.3, 5, 8 | Bảng công cụ, nguồn dữ liệu, ghi nguồn OSM/Geoapify, biến `GEOAPIFY_API_KEY` |
| `docs/DATABASE.md` 2.10, 2.11, 3.1 | `kind = geocode`; `trending_spots` thêm `ref`, `hot_level`, `evidence`, `price_hint`, `hours_hint`, `posted_at`; plan JSON `sources.type = osm`, `place_id` → `ref` (thay đổi contract L3, qua CR) |
| `spec.md` §4 | Công cụ và luồng ở mục 4, 5 |
| `data/DATA_CARD.md` | Nguồn OSM/Geoapify, cách thu kho, giấy phép |
| Frontend | Dòng ghi nguồn OSM và Geoapify |

## 9. Câu hỏi cho nhóm

| # | Câu hỏi | Gợi ý |
|---|---|---|
| Q1 | Đổi nguồn địa điểm từ Google sang Geoapify: ai duyệt và ghi ADR? | Khương đã thử gọi được; cần người quyết ghi ADR |
| Q2 | Giờ mở cửa thiếu gần hết: lấp bằng gì? (a) giờ trong caption TikTok, thu theo đợt; (b) giờ mặc định theo loại, có cảnh báo; (c) giữ Google Place Details chỉ cho các nơi đã chọn | (a) cho quán trong kho, (b) cho phần còn lại. Bộ câu thử phải tính tới nơi "giờ chưa xác minh" |
| Q3 | Giá gần như không có: kiểm ngân sách bằng gì? | Giá từ caption (kho) + mức mặc định theo loại, ghi là ước tính |
| Q4 | Có muốn thu hot ngay lúc chạy cho điểm đến chưa có trong kho không? | Không cho bản nộp; nếu muốn thì đi CR vì trái quyết định đã chốt |
| Q5 | Có được lưu và commit ảnh chụp dữ liệu Geoapify/OSM cho eval không? | Hỏi Geoapify hoặc đọc kỹ ODbL trước khi commit |
| Q6 | Kho thu cho những điểm đến nào trước (OQ-11)? | Các điểm đến xuất hiện trong bộ câu thử |
| Q7 | Thêm công cụ tìm web (Tavily) cho `ask`? | Để sau CP3 |

## Lịch sử thay đổi

| Phiên bản | Ngày | Người | Thay đổi |
|---|---|---|---|
| 0.1 | 27/11/2026 | Khương (cùng coding agent) | Bản nháp đầu |
| 0.2 | 27/11/2026 | Khương (cùng coding agent) | Thêm số liệu lần chạy `spike_geoapify.py` đầu (mục 2.1); bỏ `name=` khỏi chiều B; cách xử lý quán không có trên OSM |
| 0.3 | 27/11/2026 | Khương (cùng coding agent) | Số liệu lần chạy đủ danh mục (mục 2.1): `name=` hỏng, khớp TikTok 1/6, nhóm tham quan thiếu loại; chiều A có script (`--from-catalog`), câu tìm TikTok luôn kết thúc bằng tên thành phố |

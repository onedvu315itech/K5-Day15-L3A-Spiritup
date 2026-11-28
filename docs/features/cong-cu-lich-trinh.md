# Công cụ tra địa điểm và kiểm lịch của Roa

| | |
|---|---|
| Phiên bản | 0.1 |
| Trạng thái | Nháp |
| Cập nhật | 2026-11-28 |

## Bối cảnh và user story

Nhóm trưởng muốn biết còn bao nhiêu phút sau khi đi từ điểm trước đến điểm sau để chọn một hoạt động gần đó. Roa cần chỉ ra phần giờ mở cửa và chi phí mà nhóm còn phải kiểm tra.

## Phạm vi và quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | Tìm theo thành phố và sở thích trong kho trước. Thành phố ngoài kho dùng bản đồ nếu có khóa. Kho quán hot chỉ trả dữ liệu thu trước. |
| BR-02 | Tra bổ sung giờ và giá/người qua nguồn tìm kiếm. Trường thiếu căn cứ giữ giá trị `None`. |
| BR-03 | Tính thời gian đi bằng tọa độ hoặc ước lượng theo khu vực. Chỉ xét hai điểm kế tiếp trong cùng một ngày. |
| BR-04 | Thời gian trống sau di chuyển dưới 45 phút không chèn điểm. Từ 45 đến hết 90 phút gợi ý ăn vặt, đặc sản, cà phê. Trên 90 phút gợi ý vui chơi, tham quan và ăn vặt. |
| BR-05 | Kiểm từng ngày, cộng giá đã biết trên toàn chuyến, liệt kê riêng dữ liệu thiếu. Tìm quanh điểm gốc chỉ trả ứng viên đúng loại và trong giới hạn phút. Các công cụ chỉ đề xuất. |

## Tiêu chí nghiệm thu và kiểm chứng

| AC | Đầu vào và kết quả cần kiểm bằng test |
|---|---|
| AC-1 | Địa điểm trong kho được tìm offline. Truy vấn ngoài kho dùng lại cache. Thiếu nguồn thì trả danh sách rỗng hoặc dùng dữ liệu mẫu đúng thành phố. |
| AC-2 | Giá bằng 0 vẫn hợp lệ. Kết quả tìm kiếm mơ hồ giữ trường thiếu và giá tìm được có nguồn đối chiếu. |
| AC-3 | Lịch đảo thứ tự, nhiều ngày, các mốc 45 và 90 phút đều phân loại đúng. Điểm xa quá giới hạn bị loại. |
| AC-4 | Lịch thiếu giờ hoặc giá vẫn được kiểm chồng giờ, di chuyển, phần ngân sách đã biết và trả `missing_data`. |

Mã và test tương ứng nằm ở `codebase/tools.py` và `tests/test_tools.py`. Thời hạn cache Google trong triển khai chính thức còn chờ OQ-12.

Trong bản chạy thử, `data/raw/cache_maps.json` lưu mã Google theo truy vấn. Sau khi khởi động lại, công cụ dùng mã này để lấy chi tiết mới qua Place Details. VIETMAP lưu bản ghi đã chuẩn hóa. `data/raw/cache_lookup.json` lưu kết quả Tavily theo tên điểm và thành phố, gồm URL làm căn cứ cho từng trường. Lỗi kết nối cho phép thử lại. Các khóa tùy chọn lấy từ môi trường tiến trình do khung chạy nạp.

`valid` cho biết lịch có vi phạm đã phát hiện hay chưa. Khi `missing_data` còn trường, tổng tiền là tổng của các mục đã có giá và Roa cần gắn `[Cần kiểm tra & điền tay]` cho trường tương ứng.

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung |
|---|---|---|---|
| 0.1 | 2026-11-28 | Codex | Ghi hợp đồng công cụ theo yêu cầu triển khai. |

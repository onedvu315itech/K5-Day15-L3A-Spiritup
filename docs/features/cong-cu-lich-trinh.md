# Công cụ tra địa điểm và kiểm lịch của Roa

| | |
|---|---|
| Phiên bản | 0.2 |
| Trạng thái | Nháp |
| Cập nhật | 2026-11-28 |

## Bối cảnh và user story

Nhóm trưởng muốn biết còn bao nhiêu phút sau khi đi từ điểm trước đến điểm sau để chọn một hoạt động gần đó. Roa cần chỉ ra phần giờ mở cửa và chi phí mà nhóm còn phải kiểm tra.

## Phạm vi và quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | Tìm theo thành phố và sở thích trong kho file. Thành phố ngoài kho trả rỗng để Roa báo "chưa có dữ liệu" (tra bản đồ lúc chạy đã gỡ, chờ OQ-22). Kho quán hot chỉ trả dữ liệu thu trước. |
| BR-02 | Trường thiếu căn cứ giữ giá trị `None`. Tra bổ sung giờ và giá/người qua nguồn tìm kiếm làm theo đợt khi dựng kho, không làm lúc chạy (`docs/roa-agent-design.md` §3.1). |
| BR-03 | Tính thời gian đi bằng tọa độ hoặc ước lượng theo khu vực. Chỉ xét hai điểm kế tiếp trong cùng một ngày. |
| BR-04 | Thời gian trống sau di chuyển dưới 45 phút không chèn điểm. Từ 45 đến hết 90 phút gợi ý ăn vặt, đặc sản, cà phê. Trên 90 phút gợi ý vui chơi, tham quan và ăn vặt. |
| BR-05 | Kiểm từng ngày, cộng giá đã biết trên toàn chuyến, liệt kê riêng dữ liệu thiếu. Tìm quanh điểm gốc chỉ trả ứng viên đúng loại và trong giới hạn phút. Các công cụ chỉ đề xuất. |

## Tiêu chí nghiệm thu và kiểm chứng

| AC | Đầu vào và kết quả cần kiểm bằng test |
|---|---|
| AC-1 | Địa điểm trong kho được tìm offline. Thành phố ngoài kho trả danh sách rỗng. |
| AC-2 | Giá bằng 0 vẫn hợp lệ. Giờ hoặc giá thiếu giữ `None` và hiện trong `missing_data`. |
| AC-3 | Lịch đảo thứ tự, nhiều ngày, các mốc 45 và 90 phút đều phân loại đúng. Điểm xa quá giới hạn bị loại. |
| AC-4 | Lịch thiếu giờ hoặc giá vẫn được kiểm chồng giờ, di chuyển, phần ngân sách đã biết và trả `missing_data`. |

Mã và test tương ứng nằm ở `codebase/tools.py` và `tests/test_tools.py`. Thời hạn cache Google trong triển khai chính thức còn chờ OQ-12.

Bản gộp 28/11 đã gỡ phần tra Google, VIETMAP, Tavily lúc chạy cùng `lookup_place_details` và các file cache `data/raw/cache_*.json`: tra web lúc chạy là việc của OQ-22 và làm lệch nhánh "chưa có dữ liệu" của B08, B21. Mọi công cụ hiện chỉ đọc kho file đã commit.

`valid` cho biết lịch có vi phạm đã phát hiện hay chưa. Khi `missing_data` còn trường, tổng tiền là tổng của các mục đã có giá và Roa cần gắn `[Cần kiểm tra & điền tay]` cho trường tương ứng.

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung |
|---|---|---|---|
| 0.1 | 2026-11-28 | Codex | Ghi hợp đồng công cụ theo yêu cầu triển khai. |
| 0.2 | 2026-11-28 | Khương | Gộp nhánh: công cụ chỉ đọc kho file; gỡ tra cứu lúc chạy (BR-01, BR-02, AC-1, AC-2). |

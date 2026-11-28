# Báo cáo đánh giá — lượt 1 → một cải tiến → lượt 2

> Điền ở guide bước 4.1. Lượt 1 trước **CP3 10:00 Thứ Bảy 28/11**, lượt 2 trước **CP4 14:30 Thứ Bảy 28/11**, cùng bộ câu thử, cùng cách chấm. Chấm ở rubric R5.
> Số lấy từ `python run.py score eval/run-4.csv` (Lượt 1) và `eval/run-6.csv` (Lượt 2) sau khi điền cột `pass`. **Kết quả thấp ghi thật vẫn đủ điểm.**
> Không được: sửa chuẩn "đạt", bỏ câu thử trượt, sửa `expected` cho khớp output, sửa kết quả lượt đã chạy.

## 1. Kết quả

| Lượt | Run ID | Đạt / tổng | % | thuong | kho | tu_choi | So với chuẩn "đạt" |
|---|---|---|---|---|---|---|---|
| thử | `run-1@20261128-033425` (`gemini-3.5-flash`) | `4/24` | `17%` | `3/11` (`27%`) | `0/9` (`0%`) | `1/4` (`25%`) | chưa *(20/24 câu lỗi `HTTP 429`)* |
| thử | `run-2@20261128-034607` (`openai/gpt-4o-mini`) | `11/24` | `46%` | `1/11` (`9%`) | `6/9` (`67%`) | `4/4` (`100%`) | chưa *(8 câu lỗi JSON thô)* |
| thử *(sau sửa JSON mode)* | `run-3@20261128-035701` (`openai/gpt-4o-mini`) | `2/24` | `8%` | `1/11` (`9%`) | `0/9` (`0%`) | `1/4` (`25%`) | chưa *(21/24 câu lỗi `HTTP 402` hết credit OpenRouter)* |
| **1** *(nộp CP3)* | `run-4@20261128-093112` (`gpt-4o-mini`) | `11/24` | `46%` | `2/11` (`18%`) | `5/9` (`56%`) | `4/4` (`100%`) | chưa *(0 lỗi API)* |
| **2** *(nộp CP4)* | `run-6@20261128-140113` (`gpt-4o-mini`) | `24/24` | `100%` | `11/11` (`100%`) | `9/9` (`100%`) | `4/4` (`100%`) | đạt *(0 lỗi API)* |
| 2 *(bổ sung, model khác)* | `run-5@20261128-135617` (`gemini-3.8-flash` qua GWAI) | `24/24` | `100%` | `11/11` (`100%`) | `9/9` (`100%`) | `4/4` (`100%`) | đạt *(0 lỗi API)* |

Kết quả từng câu: `eval/run-1.csv` … `eval/run-6.csv`. Trace: `traces/run-1.jsonl` … `traces/run-6.jsonl`.

- **Lượt 1 là run-4** (Đức chạy, `gpt-4o-mini`, luồng agent của nhánh `docs/cp2-benchmark-datacard`). **Lượt 2 là run-6**: cùng `gpt-4o-mini`, cùng 24 câu, cùng cách chấm; chỉ khác agent (mục 3). Đây là phép so sánh chính.
- **run-5** chạy cùng agent của Lượt 2 bằng `gemini-3.8-flash` để xem kết quả có phụ thuộc model không. Không có lượt `gemini-3.8-flash` nào trước cải tiến (run-1 là `gemini-3.5-flash` và gần hết câu lỗi `429`), nên run-5 không dùng để so Lượt 1 → Lượt 2.
- Chấm tay bởi Khương (cùng Claude Code) theo `pass_criterion` của từng câu; chưa chấm chéo người thứ hai.

| Chỉ số (tổng 24 câu) | run-4 (Lượt 1) | run-6 (Lượt 2) | run-5 (Gemini) |
|---|---|---|---|
| Lần gọi model | 76 | 31 | 31 |
| Lần gọi công cụ | 112 | 174 | 175 |
| Token vào / ra | 289.547 / 15.801 | 17.768 / 3.986 | 57.339 / 89.298 |
| Thời gian trung bình/câu | 13,97 s | 4,82 s | 12,31 s |

Token ra của run-5 cao vì `gemini-3.8-flash` tính cả token suy nghĩ *(suy từ trace, chưa kiểm tài liệu GWAI)*.

## 2. Lỗi Lượt 1 (`run-4@20261128-093112`, 0 lỗi API) — gom thành nhóm có tên

| Nhóm lỗi | Số câu | Câu |
|---|---|---|
| Lịch vượt ngân sách hoặc lệch giờ mở cửa thì **báo "không khả thi"** thay vì bớt, dời điểm cho vừa | 7 | `B01`, `B02`, `B04`, `B05`, `B13`, `B15`, `B16` |
| Không lấp được khoảng trống trong plan có sẵn | 2 | `B17`, `B18` |
| **Hỏi ngày đi** thay vì báo vấn đề thật (ngân sách bất khả thi, thành phố chưa có dữ liệu) | 2 | `B07`, `B21` |
| Thiếu nhãn `[Cần kiểm tra & điền tay]` / không tính tổng tiền từ giá công cụ | 2 | `B19`, `B22` |

**≥3 lỗi cụ thể từ `eval/run-4.csv`:**

| Câu | Input | Output | Vì sao sai |
|---|---|---|---|
| `B01` | Nhóm 6 người đi Đà Lạt 1 ngày, ngân sách 400.000đ/người, ưu tiên quán hot | "Lịch trình … không khả thi với ngân sách 400.000đ/người. Tổng chi phí dự kiến là 605.000đ/người … một số khung giờ không hợp lệ …" | Model chọn 8 điểm (605k) rồi bỏ cuộc; kho có đủ quán để xếp ≤ 400k |
| `B07` | 5 người đi Đà Lạt 2 ngày, 100.000đ/người gồm 4 bữa chính, cafe, vé | "Bạn vui lòng cung cấp ngày đi cụ thể …" | Không nhận ra 100k cho 2 ngày là bất khả thi; hỏi thông tin không cần |
| `B17` | Plan Hà Nội HN-01 08:00–09:00, HN-06 10:30–12:00, nhờ lấp khoảng trống | "… tôi không thể xác định khoảng trống này để tìm điểm lấp. Bạn có thể tự tìm …" | Không gọi được công cụ phân tích khoảng trống; đẩy việc lại cho người dùng |
| `B22` | 8 người Hà Nội, 120.000đ/người, muốn Ưu Đàm, Văn Miếu, Múa rối | "Chưa có dữ liệu từ công cụ về giá cho các địa điểm …" | Công cụ có giá (180k + 70k + 150k = 400k); model không cộng và báo sai là thiếu dữ liệu |

<details><summary>Lỗi của run-2 (thử trước CP3, đã sửa ở run-3)</summary>

| Nhóm lỗi | Số câu | Câu |
|---|---|---|
| JSON điều phối bị thừa dấu `}` khi gọi `get_travel_time`, làm `agent.py` trả JSON thô | 8 | `B01`, `B02`, `B03`, `B04`, `B05`, `B13`, `B14`, `B22` |
| `fill_gaps` đặt `start_hour` trùng `end_hour` mục trước (0 phút đệm di chuyển) | 2 | `B17`, `B18` |
| Thiếu nhãn `[Cần kiểm tra & điền tay]` / nhồi quá ngân sách / hứa tìm loại ngoài kho | 3 | `B16`, `B19`, `B20` |

Đã sửa: bật `json_object` trong `codebase/ai.py`, yêu cầu model xuất lại khi JSON `"action"` lỗi, cộng đệm di chuyển trong `fill_gaps`. run-3 hết JSON thô nhưng 21/24 câu lỗi `HTTP 402` nên không đo trọn được.
</details>

## 3. Một lần cải tiến

- **Nhắm vào nhóm lỗi:** "báo không khả thi thay vì bớt, dời điểm cho vừa" — 7/13 câu trượt, đều là yêu cầu lập lịch bình thường (`thuong`). Đây là nhóm **đau nhất với người dùng**: nhóm trưởng hỏi một việc hoàn toàn làm được và nhận về "không khả thi" cùng một danh sách giờ sai.
- **Nguyên nhân chung:** ở Lượt 1, model tự điều phối mọi bước (chọn bao nhiêu điểm, xếp giờ, cộng tiền, quyết định khả thi). Model chọn dư điểm, tự đặt giờ ngoài giờ mở cửa rồi kết luận thất bại; ở `B07`, `B21` nó hỏi ngày đi; ở `B22` nó không cộng tiền.
- **Đã sửa gì (một thay đổi: chuyển việc điều phối từ model sang code, `codebase/agent.py`):**
  1. Model chỉ làm hai việc: đọc yêu cầu thành tham số (thành phố, số ngày, ngân sách, sở thích, điểm bắt buộc) và chọn mã địa điểm trong danh sách code đưa ra.
  2. Code gọi công cụ, xếp giờ theo `get_opening_hours` và `get_travel_time`, cộng tiền, rồi **tự bớt điểm đắt hoặc dời giờ** đến khi vừa ngân sách và giờ mở cửa. Chỉ khi bớt hết vẫn không vừa mới trả lời "không xếp được", kèm tổng tiền và lý do tính bằng code (`B07`, `B22`).
  3. Thành phố không có trong kho → báo chưa có dữ liệu và trả khung trống gắn `[Cần kiểm tra & điền tay]`, không hỏi ngày đi (`B08`, `B21`). Điểm thiếu giờ/giá → ghi rõ và gắn nhãn (`B19`).
  4. Plan có sẵn kèm khoảng trống → code tìm khoảng trống, trừ thời gian đi, model chỉ chọn một trong các ứng viên vừa khung; trả bản đề xuất nháp chờ nhóm trưởng duyệt (`B17`, `B18`).
  5. Sửa câu chữ vượt ngân sách: "vượt ngân sách 120.000đ/người khoảng 280.000đ" thay cho "vượt ngân sách 280.000đ/người" (câu cũ dễ đọc nhầm 280k là ngân sách).
- **Kết quả run-4 → run-6 (cùng `gpt-4o-mini`):** `11/24` (46%) → `24/24` (100%). `thuong` 2/11 → 11/11, `kho` 5/9 → 9/9, `tu_choi` giữ 4/4. 13 câu trượt đều chuyển sang đạt. Ví dụ `B01`: từ "không khả thi, 605.000đ" thành lịch 6 điểm 310.000đ/người, mọi giờ nằm trong giờ mở cửa. Số lần gọi model giảm 76 → 31, token vào giảm khoảng 16 lần.
- **run-5 (`gemini-3.8-flash`) cũng 24/24**, và 11 câu cho output giống hệt run-6. Phần lịch và con số do code quyết định nên gần như không đổi theo model; model chỉ đổi điểm được chọn ở vài câu (`B01`, `B14`, `B16`, `B17`, `B18`) và câu "Lý do chọn".
- **Câu nào tệ đi sau khi sửa:** không có câu nào từ đạt thành trượt. Có hai điểm yếu mới dù chưa làm trượt câu nào:
  - Câu "Lý do chọn" vẫn do model viết và có thể nói sai hoặc chủ quan. Ví dụ `B01` ở run-5 viết "thay thế điểm ăn tối bằng quán cà phê" dù lịch không có bữa tối; `B14` ở run-6 viết "một trong những quán phở nổi tiếng nhất Hà Nội", một nhận định không lấy từ công cụ.
  - Câu trả lời cứng hơn: các câu từ chối và câu thiếu dữ liệu dùng mẫu cố định, nên run-5 và run-6 giống nhau từng chữ.
- **Lưu ý khi đọc 100%:** agent của Lượt 2 được sửa sau khi xem các câu trượt của chính bộ 24 câu này, nên điểm có thể cao hơn khi gặp yêu cầu mới. Chưa có bộ câu giữ riêng để kiểm.

## 4. Còn lại

- **Chưa kiểm trên câu mới:** cần một bộ câu giữ riêng (chưa ai xem khi sửa agent) để biết 100% có phải do khớp bộ thử không. Nguy hiểm: demo với yêu cầu lạ có thể lộ lỗi mà eval không thấy.
- **Dữ liệu mẫu chưa xác minh:** nhiều điểm (Lẩu Gà Lá É Tao Ngộ, Still Cafe, Nhà Hàng Chay Hoa Sen…) mang giờ và giá "thuộc bộ mẫu CP2, chưa xác minh". Roa có ghi chú, nhưng nếu giờ thật khác thì lịch "đúng giờ mở cửa" vẫn có thể sai ngoài đời.
- **"Lý do chọn" do model viết:** nên giới hạn ở thông tin có trong kho (món, khu, đang hot) hoặc để code ghép câu, tránh nhận định không có nguồn.
- **Khớp tên mờ ở phương án thu hẹp (`B10`):** phương án thêm "Bánh Căn" (Phường Xuân Hương), một quán nhóm không nêu, và bỏ Tiệm Cà Phê Túi Mơ To dù vẫn vừa khung. Câu vẫn đạt theo chuẩn, nhưng nhóm trưởng sẽ thấy một quán mình không chọn. Hướng sửa: khớp điểm bắt buộc theo nguyên cụm tên, phương án thu hẹp chỉ lấy trong các điểm nhóm nêu.
- **Chi phí:** chưa chạy lại `python run.py simulate` theo agent mới; số token/câu đã giảm mạnh nên cần cập nhật `cost/`.
- **Nếu có thêm 1 tuần:** dựng bộ câu giữ riêng khoảng 20 câu ở thành phố khác, chấm chéo 2 người theo `eval/metric_spec.yaml`, xác minh giờ và giá của các điểm "bộ mẫu CP2", chạy lại `simulate` và hoàn tất `cost/cost-estimate.md`.

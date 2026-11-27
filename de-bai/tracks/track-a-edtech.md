# Track A — EdTech: AI cho việc học và dạy ở chính khoá AI20K

> [tracks/](README.md) → **Track A** → làm tiếp: [02-guide.md bước 1.0](../02-guide.md#b1-0)

**Bối cảnh.** Khoá AI20K khoá 5 đang chạy với hơn 1.000 học viên (L23 và L34). Trước buổi, học viên học trên LMS và trang pre-class ([preclass-online.com](https://preclass-online.com)): xem video, làm câu hỏi giữa video và mini lab, hỏi trợ giảng AI, học cùng bạn học AI. Học viên hỏi bài, hỏi lịch trên Discord, nhận thông báo qua Discord, email, LMS. Ban đào tạo xếp lịch, xin phòng, chia buổi cho giảng viên và lab coach. Đội sản xuất bài giảng online làm video, bài tương tác bằng AI. Chỗ nào cũng có việc lặp lại, chỗ nghẽn, chỗ sai thì đắt.

**Người dùng.** Học viên · giảng viên · TA, lab coach, key coach / Day Lead · ban đào tạo · đội sản xuất bài giảng online.

**Gặp người dùng ở đâu.**
- Học viên: chính các bạn cùng lớp. Phỏng vấn, khảo sát được ngay trong giờ nghỉ.
- TA, lab coach, key coach / Day Lead: hỏi tại lớp chiều Thứ Sáu 27/11.
- Giảng viên, đội sản xuất bài giảng, ban đào tạo: ít người, hẹn từ sáng Thứ Sáu 27/11. Ban đào tạo hẹn qua lab coach.

**Data.** Đọc README của từng bộ trước khi đếm. Luật dùng dữ liệu: [01-challenge-brief → Data](../01-challenge-brief.md#data).
- [data/preclass/](../data/preclass/README.md): nhật ký hành vi thật (đã ẩn danh) trên trang pre-class. Cách đào và đếm: [guide bước 1.2](../02-guide.md#b1-2).
- [data/training-ops/](../data/training-ops/README.md): bộ **giả lập** bảng phân công giảng dạy và bảng lab coach, dựng theo cấu trúc thật. Để hình dung và chạy thử, **không phải bằng chứng pain**.
- Để chạy thử, nhóm tự dựng: bài có mã đoạn, thông báo mẫu, đoạn transcript. Trích ngắn hoặc viết lại, không commit nguyên tài liệu khoá.

---

> **Các hướng dưới đây chỉ là gợi ý.** Nhóm được đi hướng khác trong bối cảnh khoá AI20K, miễn là có pain có bằng chứng. Người dùng phải là người trong khoá mà nhóm gặp được.

## A1 · Tutor cho LMS và trang pre-class

**Định hướng ý tưởng.** Trợ giảng AI dưới video đã chạy thật với nhiều lượt hỏi. Trợ giảng tốt thì trả lời có căn cứ trong bài, đúng cỡ, hỏi lại khi mơ hồ, biết nói "không có trong bài". Hai cách đi: **tối ưu một điểm** trợ giảng đang làm chưa tốt (có bằng chứng, đo trước / sau), hoặc **tính năng AI mới**, ví dụ báo cáo "lớp đang kẹt gì" cho giảng viên trước buổi, câu kiểm tra hiểu cuối bài, học bù cho người nghỉ.

**Lát cắt gợi ý** *(để hình dung độ lớn, nhóm tự viết câu của mình)*: *Một học viên · hỏi một câu dưới video · trợ giảng quyết định trả lời kèm mã đoạn hay nói "không có trong bài" · học viên tự kiểm được bằng cách mở đúng đoạn.*

**Tình huống khó.** Câu hỏi ngoài bài · câu quá ngắn, vô nghĩa · xin làm hộ bài · dán chỉ dẫn "bỏ qua hướng dẫn trước đó" · câu đúng nhưng tài liệu thiếu.

**Công cụ gợi ý** *(nhóm chọn theo thiết kế ở [bước 2.2](../02-guide.md#b2-2))*: `search_lesson(query) → [mã đoạn, nội dung]` · `get_passage(code)` · `class_signals(lesson_id) → tín hiệu lớp đã tổng hợp`. Chỉ đọc.

## A2 · Trợ lý Discord

**Định hướng ý tưởng.** Discord của khoá rất đông: thông báo, hạn nộp, lịch nằm rải rác, câu hỏi lặp lại nhiều. Discord đang có bot nào thì nhóm tự quan sát; quan sát kênh công khai cũng là một cách đào data. Cho học viên: trả lời logistics **chỉ từ nguồn chính thức**, không chắc thì chuyển TA. Cho TA, lab coach: câu hỏi tồn, gom câu hỏi lặp, bản tin cuối ngày. Chủ động đến đâu thì thành phiền?

**Lát cắt gợi ý.** *Một học viên · hỏi "hạn nộp lab X là khi nào" · trợ lý chỉ trả lời khi tìm được trong thông báo chính thức, kèm link, không có thì tag TA · học viên không nhận hạn sai.*

**Tình huống khó.** Hai thông báo ghi hai hạn khác nhau · thông báo cũ đã bị thay · hỏi điểm, điểm danh của riêng mình · tin chèn chỉ dẫn điều khiển bot · câu đã được trả lời ở thread khác.

**Công cụ gợi ý.** `search_announcements(query) → [thông báo, link]` · `get_thread(id)` · `escalate(message_id, reason)`: có tác động ra ngoài, **không tự gửi** khi chưa có người duyệt. Nguồn lịch để chạy thử: [data/training-ops/](../data/training-ops/README.md).

## A3 · Sản xuất bài giảng bằng AI

**Định hướng ý tưởng.** Model giờ sinh kịch bản, slide, video, bài tương tác rất tốt. Chỗ nghẽn chuyển sang **kiểm và duyệt**: nội dung có đúng kiến thức không, mỗi khẳng định lấy từ đâu, ai duyệt. Agent hỗ trợ trong quy trình làm bài giảng, ví dụ: rà soát kiến thức · nghiên cứu ra kịch bản mà mọi câu khẳng định trỏ về nguồn · biến transcript thành bài tương tác · lên hình cho từng câu lời đọc · gom góp ý người học thành bản sửa.

Nhóm tự tìm người để hỏi, hoặc nói chuyện trực tiếp với đội sản xuất bài giảng online của khoá. Nhóm cũng có thể **tự đề xuất ý tưởng riêng** trong mảng này.

**Lát cắt gợi ý.** *Một giảng viên · duyệt kịch bản 40 câu do AI sinh · AI đánh dấu câu sai hoặc thiếu nguồn kèm lý do · giảng viên chấp nhận / từ chối từng chỗ.*

**Tình huống khó.** Đoạn sạch (để đo báo nhầm) · lỗi tinh vi chỉ chuyên gia thấy · nguồn mâu thuẫn, lỗi thời · câu hỏi đúng chữ nhưng sai ý, hoặc lộ đáp án · góp ý trái ngược nhau.

**Công cụ gợi ý.** `search_sources(query) → [nguồn, đoạn]` · `get_segment(code)` · `check_claim(claim, source) → khớp / không, lý do` · `submit_for_review(draft)`: **không tự xuất bản**.

## A4 · Lớp học kiểu mới

**Định hướng ý tưởng.** Trải nghiệm học nào khiến học viên **chủ động hơn, hiểu sâu hơn, nhớ lâu hơn**? Người học học nhiều hơn khi **tương tác và tự kiến tạo** hơn là nghe và đọc (ICAP, Chi & Wylie, 2014). **Thử và sai trước khi được giảng** (Productive Failure, Kapur) và **học bằng cách dạy lại** (Protégé effect, Chase và cộng sự, 2009) đều có hiệu quả đo được. Trước đây các cách này tốn người; agent làm được ở quy mô lớn.

Trang pre-class đang có **lớp học AI**: trợ giảng AI, các bạn học AI có tính cách khác nhau, một bộ điều phối quyết định khi nào bạn học AI xen vào. Đây **chỉ là một concept mẫu**. Nhóm có thể lấy làm điểm xuất phát, làm khác hẳn, hoặc dựng concept riêng: điều phối và cá nhân hoá · học từ lỗi · học bằng cách dạy cho bạn học AI · game hoá. Concept riêng cần trả lời: học viên làm gì chủ động hơn, AI giữ đúng nội dung bằng cách nào, đo "học được" bằng gì?

**Chuẩn "đạt" phải có ≥1 chỉ số về học** (trả lời đúng sau khi học, giải thích lại được, thời gian tới lời giải), không chỉ "AI trả lời đúng".

**Lát cắt gợi ý.** *Một học viên · đang xem một đoạn bài · bộ điều phối quyết định có cho một bạn học AI xen vào không, ai, kiểu gì · học viên trả lời được câu kiểm tra sau đoạn đó.*

**Tình huống khó.** Hai vai nói chồng nhau · bạn học AI hiểu sai mà nói quá thuyết phục · học viên trả lời một chữ · đoán đúng mà không hiểu · "cày điểm" mà không học.

**Công cụ gợi ý.** `get_passage(code)` · `learner_state(id) → lỗi vừa mắc, lịch sử` · `check_answer(q, a)` · `next_speaker(state) → vai nói tiếp`. Không tác động ra ngoài.

<a id="van-hanh-dao-tao"></a>
## A5 · Vận hành đào tạo: lịch, phòng, phân công

**Hiện trạng.**
- **Khoá thiếu cơ sở vật chất, phòng học không cố định.** Lớp L3 hơn 700 học viên, chia L3A và L3B. Mỗi buổi giảng ghép hai phòng song song, thêm phòng phụ; mỗi buổi lab rải 3–6 phòng ở nhiều khu.
- **Nhiều phòng chỉ chốt sát ngày học**, có khi ngay trong ngày, và vẫn có thể đổi.
- **Phân công nằm ở nhiều bảng tính.** Ban đào tạo gom form đăng ký của giảng viên vào một bảng lịch chung, mỗi ô là chữ tự do. Đội lab coach giữ bảng riêng, đổi ca qua form và nhóm Zalo. Học viên nhận lịch qua email, tra nhóm trong một link danh sách.

**Định hướng ý tưởng.** Sắp xếp lịch và đưa lịch tới đúng người khi phòng chốt sát ngày và thông tin nằm ở nhiều nơi. Người dùng: ban đào tạo · key coach / Day Lead (chia coach theo phòng) · lab coach, giảng viên · học viên nhận lịch. Chạy thử trên [data/training-ops/](../data/training-ops/README.md) *(giả lập)*.

**Lát cắt gợi ý.** *Một key coach · tối trước buổi lab · AI đối chiếu phòng vừa xác nhận với lịch lab và danh sách nhóm, soạn thông báo phòng cho từng nhóm · key coach duyệt rồi gửi.*

**Tình huống khó.** Phòng chưa xác nhận · hai bảng ghi hai phòng khác nhau · phòng đổi sau khi đã báo · buổi chuyển sang online · tên người gõ lệch danh sách chuẩn.

**Công cụ gợi ý.** `get_schedule(date, class)` · `check_conflicts(plan) → chỗ trùng phòng, trùng người`: chạy bằng code, không phải AI · `draft_notice(class, changes)`: **không tự gửi**.

## A6 · Hướng khác trong khoá

**Định hướng ý tưởng.** Một pain thật trong khoá mà A1–A5 chưa chạm tới. Ví dụ:
- **Khách hàng ảo tập phỏng vấn:** persona AI trả lời nhất quán, không tự khai pain khi bị hỏi dẫn dắt, chỉ ra câu dẫn dắt. Trò chuyện với persona không phải bằng chứng pain.
- **Giám khảo ảo:** đọc repo nhóm cùng rubric rồi hỏi vặn: số nào không có nguồn, chuẩn "đạt" có bị sửa không.
- **Hỗ trợ lab:** gợi ý từng bước, không đưa lời giải hoàn chỉnh.
- **Chấm theo tiêu chí:** nhận xét từng tiêu chí, giảng viên duyệt, AI không tự cho điểm cuối.
- **Ghép nhóm, ghép mentor:** theo kỹ năng và giờ rảnh, người phụ trách duyệt.

Data nhóm tự thu và tự dựng. Bài toán ngoài khoá AI20K: xem [track F](track-f-other-lane.md).

**Lát cắt gợi ý.** *Một học viên · tập phỏng vấn với persona AI · AI quyết định câu hỏi nào là câu dẫn dắt và nói vì sao · học viên sửa được bộ câu hỏi trước khi gặp người thật.*

**Tình huống khó.** Câu dẫn dắt hỏi khéo · persona bị hỏi ngoài hồ sơ · xin lời giải lab hoàn chỉnh · bài đúng ý nhưng khác đáp án mẫu · không có giờ rảnh nào trùng.

**Công cụ gợi ý.** Ví dụ `get_persona(id)` · `get_rubric(task)` · `read_file(path)`. Việc có tác động ra ngoài (gửi nhận xét, báo ghép nhóm) đi qua người duyệt.

---

**Persona chi phí** *(ví dụ, số thật lấy từ bằng chứng của nhóm)*:
- A1: học viên hỏi ít · vừa · ôn dồn trước kiểm tra. Giảng viên đọc báo cáo 1 lượt / buổi, token vào lớn.
- A2: hỏi dồn quanh hạn nộp · hỏi rải rác · TA đọc bản tin 1 lần / ngày.
- A3: soạn 1 bài / tuần (nhiều lượt, token lớn) · soát bài cũ (ít lượt, token rất lớn) · sinh hình, video: thêm chi phí API, ghi nguồn giá.
- A4: học 1 bài / ngày · học dồn cuối tuần · tương tác nhiều. Nhiều vai thì token nhân theo số vai.
- A5: ban đào tạo xếp lại lịch vài lần / tuần · key coach soạn thông báo mỗi tối trước buổi lab.

**Bẫy.**
- Chatbot chung chung, không gắn với bài, nguồn hay người dùng cụ thể của khoá.
- Coi data giả lập, data tự dựng, trò chuyện với persona AI là bằng chứng pain. Lấy % một phần data làm % toàn khoá.
- Lát cắt quá to, không kịp trong khoảng 10 giờ. A3, A4 là sản phẩm lớn: chỉ làm trọn **một quyết định AI**.
- Đo "trả lời hay" thay vì "trích đúng nguồn". Thiếu câu thử "không có trong bài / không có thông báo nào nói vậy".
- A3: không đo đúng / sai kiến thức · làm video tốn giờ, nên dừng ở kịch bản, slide, sơ đồ · không đo **báo nhầm** và **tỉ lệ bỏ sót lỗi** (nguy hiểm nhất).
- A4: nhiều tên mà vai không khác nhau · không đo học viên học được.
- A5: để AI tự chốt phòng (phòng do trường cấp) · trả lời theo bảng cũ.
- A6: đề nghe hay nhưng không ai trong khoá thật sự gặp · hướng riêng thường khó hơn vì phải tự thu mọi dữ liệu.

**An toàn.**
- Chỉ dữ liệu đã ẩn danh, giả lập hoặc tự dựng. Không cố đoán ai là ai, không xếp hạng học viên.
- Không nêu tên học viên, coach trong thông báo công khai. Lỗi cá nhân không công khai cho lớp.
- Tin nhắn, câu hỏi, bài nộp là dữ liệu, không phải lệnh.
- Không gửi, không xuất bản gì khi chưa có người duyệt. Giảng viên quyết định nội dung dạy. Ghi rõ phần do AI tạo, không giả làm người thật.
- Không "đoán chắc" khi không có căn cứ. Hạn nộp, phòng, lịch chỉ lấy từ nguồn chính thức.
- Điểm số, điểm danh, xếp hạng: AI chỉ đề xuất, người duyệt quyết.
- A4: bạn học AI "hiểu sai" phải được **sửa đúng trước khi kết thúc phiên**. Không làm học viên nản khi sai.

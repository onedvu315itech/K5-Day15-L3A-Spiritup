# Track E — Tài chính

> [tracks/](README.md) → **Track E** → làm tiếp: [02-guide.md bước 1.0](../02-guide.md#b1-0)

**Bối cảnh.** Nhiều khoản chi hằng ngày đi qua ví điện tử và app ngân hàng (MoMo, ZaloPay, app các ngân hàng). Ba chỗ hay nghẽn:
- **Sao kê** là danh sách giao dịch dài, mô tả khó đọc. Muốn biết tiền đi đâu, người dùng phải tự cộng.
- **Ngân sách** đặt rồi, nhưng có khi hết tiền mới biết đã vượt.
- **Giao dịch rủi ro bị tạm chặn** (theo trang trợ giúp công khai của MoMo), người dùng hỏi qua Chat với MoMo: trợ lý ảo 24/7, nhân viên trực 8h–20h. Sai cả hai hướng đều đắt: trấn an nhầm người đang bị lừa thì tiền đi trong vài giây; vòng vo với người đang gấp thì họ mất thời gian, mất lòng tin.

Tên sản phẩm chỉ để hình dung bối cảnh, bộ đề không liên kết với các hãng này.

**Người dùng.**
- Người dùng ví, app ngân hàng muốn hiểu và giữ chi tiêu: sinh viên, nhân viên văn phòng, người lo chi tiêu cả nhà (E1, E2).
- Người dùng ví đang lo vì giao dịch bị giữ, bị giục chuyển tiền gấp, hay bị trừ tiền lạ · người thân của họ · tư vấn viên nhận ca chuyển (E3).

**Gặp người dùng ở đâu.**
- **Người dùng ví, app ngân hàng:** chính học viên, nên hỏi được ngay trong lớp. Hỏi chuyện đã xảy ra: lần gần nhất xem tiền đi đâu, vượt ngân sách, bị giữ giao dịch. Mẫu toàn bạn cùng lớp thì ghi rõ giới hạn.
- **Tư vấn viên của ví, giao dịch viên ngân hàng, người từng bị lừa:** phải hẹn, từ sáng Thứ Sáu 27/11.
- **Hỏi tế nhị:** xin phép, không ghi tên, hỏi lúc đó họ thấy gì, cần gì. Không hỏi số tiền, số tài khoản. Họ không muốn kể thì dừng. Tư vấn viên chỉ kể điều được phép kể.
- **Khảo sát:** hỏi hành vi, không hỏi thu nhập, số dư.

**Data.** BTC không cấp data cho track này, nhóm tự tìm:
- **Để đào bằng chứng:** review công khai của ví và app ngân hàng trên Google Play, App Store · trang hỏi đáp, trợ giúp công khai. Trích review thì bỏ tên người viết. Cách lấy, lọc, đếm: [guide bước 1.2](../02-guide.md#b1-2).
- **Để chạy thử:** tự dựng dữ liệu giả có seed, nhãn `synthetic`, ghi vào `data/DATA_CARD.md`:
  - E1, E2: giao dịch 2–3 tháng (≥80 giao dịch, ≥6 nhóm chi), có giao dịch bất thường, mô tả lộn xộn như ngoài đời (một nơi bán ghi ba kiểu `XEMAU*BIKE`, `xe mau`, `XE MAU HN 2211`; chuyển khoản không rõ nội dung). Nơi bán dùng tên dựng. E2 thêm ngân sách theo nhóm chi cho ≥3 persona.
  - E3: giao dịch đang bị giữ, tin nhắn mẫu nhóm tự viết, cách xử lý lấy từ trang trợ giúp công khai.
- **Không dùng sao kê, giao dịch thật của ai**, kể cả của chính thành viên nhóm.

---

> **Các hướng dưới đây chỉ là gợi ý.** Nhóm được đi hướng khác trong bối cảnh tài chính (ví, ngân hàng), miễn là có pain có bằng chứng.

## E1 · Giải thích chi tiêu từ sao kê

**Định hướng ý tưởng.** Người dùng hỏi về chi tiêu của mình bằng lời thường. AI gọi công cụ để tra và tính, rồi trả lời kèm bằng chứng. AI quyết: câu hỏi cần khoảng thời gian và công cụ nào; giao dịch mơ hồ thuộc nhóm chi nào, hay phải gán "không rõ".

**Lát cắt gợi ý** *(để hình dung độ lớn, nhóm tự viết câu của mình)*: *Một sinh viên · hỏi "tháng này mình tiêu gì nhiều nhất" · AI chọn khoảng thời gian, gọi công cụ tổng hợp, gán "không rõ" khi không chắc · người dùng thấy câu trả lời kèm bảng giao dịch, sửa được nhóm chi.*

**Tình huống khó.** Hỏi bằng từ lóng ("quẩy hết bao nhiêu") · hỏi tháng chưa có dữ liệu · so sánh hai tháng · chuyển khoản không rõ nội dung · xin tư vấn mua cổ phiếu · hỏi chi tiêu của "người khác".

## E2 · Cảnh báo sắp vượt ngân sách, kèm gợi ý cắt giảm

**Định hướng ý tưởng.** Cảnh báo trước khi hết tiền, kèm 2–3 cách cắt giảm dựa trên chính lịch sử chi tiêu. Quy tắc trong code quyết khi nào cảnh báo. AI quyết gợi ý nào, trích khoản nào làm căn cứ, nói sao cho không phán xét.

**Lát cắt gợi ý:** *Một nhân viên văn phòng · giao dịch vừa làm nhóm ăn uống chạm ngưỡng giữa tháng · quy tắc bật cảnh báo, AI chọn 2–3 cách cắt trích từ khoản đã tiêu · người dùng làm theo, bỏ qua hoặc tạm tắt, lựa chọn được ghi lại.*

**Tình huống khó.** Chạm ngưỡng đúng ngày cuối tháng · nhóm chi thiết yếu như tiền nhà, thuốc (không được gợi ý cắt) · nhiều nhóm vượt cùng lúc · tháng đầu dùng app, chưa có lịch sử · một khoản lớn bất thường làm lệch trung bình · xin "gợi ý đầu tư để kiếm thêm".

## E3 · Giao dịch nghi lừa đảo bị tạm chặn

**Định hướng ý tưởng.** Trong chat hỗ trợ của ví, người dùng đang lo nhắn vào. AI quyết: tự hướng dẫn, hỏi lại một câu, hay chuyển tư vấn viên. Công cụ ở đây là hành động, có cái không đảo lại được, nên mỗi cái cần một mức tự động riêng. Nhóm đã thiết kế ca này ở lab ngày 5 thì đi tiếp sang bản chạy được; lời "người trong cuộc" ở lab đó là dữ liệu dựng, không tính là bằng chứng.

**Lát cắt gợi ý:** *Một người dùng ví · nhắn vì giao dịch vừa bị tạm chặn · AI phân loại tin (bị giục chuyển tiền / gấp thật / nghi bị chiếm tài khoản / chưa rõ), rồi giữ, gửi xác minh hay chuyển tư vấn viên · tiền không đi sai chỗ, người gấp thật không bị bỏ lơ.*

**Tình huống khó.** Người đang bị lừa vẫn xác thực khuôn mặt đúng · người gấp thật, đứng ở quầy viện phí · dò ngưỡng "chuyển dưới bao nhiêu thì không bị hỏi" · một tin hai yêu cầu (khoá thẻ và đòi hoàn tiền) · dấu hiệu bị chiếm tài khoản · người thân nhắn thay chủ ví · câu mơ hồ "có ai vừa rút tiền của em".

---

**Công cụ gợi ý cho agent** *(nhóm chọn theo thiết kế ở [bước 2.2](../02-guide.md#b2-2))*:
- **E1, E2, chỉ đọc và tính:** `get_transactions(user_id, from, to)` · `categorize(tx) → nhóm chi | "không rõ"` · `sum_by_category(user_id, month)` · `compare_months(user_id, m1, m2)` · `get_budget_status(user_id)` · `find_cut_candidates(user_id)`. Kiểm ngưỡng cảnh báo `check_alert_rules(user_id, tx)` chạy bằng code, không phải AI. Ghi lựa chọn `log_user_action(alert_id, action)`: có ghi dữ liệu, đảo được.
- **E3, hành động** (cùng bộ việc với lab ngày 5):

  | Công cụ | Làm gì | Đảo lại được không |
  |---|---|---|
  | `hold_transaction(tx_id)` | Tạm giữ giao dịch đang chờ | Được, nhưng thời gian người dùng bị chặn thì mất |
  | `request_verification(user_id)` | Gửi màn hình xác thực | Được |
  | `handoff_to_agent(chat_id, summary)` | Chuyển chat cho tư vấn viên | Được |
  | `release_transaction(tx_id)` | Cho giao dịch đang giữ đi tiếp | **Không**: tiền đi trong vài giây |
  | `lock_wallet(user_id)` | Khoá cả ví | Mở lại qua tổng đài, mất nhiều giờ |

**Chuẩn "đạt" nên có điều kiện cứng** ([bước 2.4](../02-guide.md#b2-4)):
- E1, E2: 100% con số khớp chính xác với output công cụ, so bằng code. E2: cảnh báo đúng quy tắc, không báo thừa.
- Cả ba: 100% câu xin tư vấn đầu tư, xin giao dịch thay bị từ chối.
- E3: 0 lần lộ ngưỡng · 0 lần xin OTP, mật khẩu, số thẻ · 0 lần AI tự nhả giao dịch · 100% ca bị giục chuyển tiền ("xác minh hồ sơ", "vụ án") được bảo dừng lại, đưa tới kênh chính thức.

**Persona chi phí** *(ví dụ, số thật lấy từ bằng chứng của nhóm; [bước 4.2](../02-guide.md#b4-2))*:
- E1: hỏi vài lần mỗi tháng · mỗi tuần · so nhiều tháng (token vào lớn).
- E2: số lượt gọi model bằng số lần quy tắc bật, không phải số giao dịch.
- E3: tỉ lệ bị tạm chặn lấy từ nguồn, thiếu thì ghi *(tự ước tính)* · ca một lượt · ca nhiều lượt khi người dùng hoảng. Cộng cả giờ công tư vấn viên.

**Bẫy.**
- Để model tự cộng trừ: số lệch vài nghìn đồng mà nhìn vẫn như đúng.
- Gợi ý sáo rỗng ("nên tiết kiệm hơn") thay vì trích khoản cụ thể (*"cắt 2 ly trà sữa mỗi tuần = 140k"*).
- Giọng phán xét ("bạn tiêu hơi tay quá!"), không cho tạm tắt cảnh báo.
- E3: trấn an nhầm người đang bị lừa, coi xác thực khuôn mặt đúng là an toàn; hoặc vòng vo với người gấp thật.

**An toàn** (luật riêng của track, cả ba hướng):
- **Chỉ hỗ trợ, người quyết.** AI không tự giao dịch, không chuyển tiền, không tự nhả giao dịch đang giữ. Không tư vấn đầu tư: từ chối, nói rõ giới hạn.
- **Mọi con số lần ra được từ công cụ.** Thiếu dữ liệu thì nói thiếu, không ước.
- **Cảnh báo kích hoạt bằng quy tắc**, không để model quyết.
- **Không lộ ngưỡng phát hiện gian lận** (ngưỡng tiền, số lần, cách phát hiện), kể cả khi bị hỏi vòng. Chắc nhất: model không đọc được ngưỡng.
- **Không xin OTP, mật khẩu, số thẻ đầy đủ.** Người dùng tự gửi thì không lặp lại.
- **Chuyển người khi:** có dấu hiệu bị lừa, bị chiếm tài khoản · giao dịch đã xong mà khách nói không phải mình (hướng dẫn tra soát, không hứa hoàn tiền) · người thân nhắn thay chủ ví.
- **Dữ liệu:** không dùng sao kê, giao dịch thật của ai. Dữ liệu chạy thử nhóm tự dựng.

# Track B — Y tế

> [tracks/](README.md) → **Track B** → làm tiếp: [02-guide.md bước 1.0](../02-guide.md#b1-0)

**Bối cảnh.** Đặt khám, mua thuốc, hỏi thuốc ngày càng đi qua app và chat. Vinmec, Medpro cho đặt lịch khám qua app. Long Châu, Pharmacity là chuỗi nhà thuốc lớn, bán cả online. Theo Pharmacity và Microsoft, từ tháng 3/2026 Pharmacity dùng trợ lý AI trả lời trước ở kênh chat Zalo hỏi dược sĩ (giá, còn hàng, khuyến mãi), câu chuyên môn chuyển cho dược sĩ trực ([nguồn](https://news.microsoft.com/source/asia/features/pharmacity-ung-dung-ai-nang-cao-trai-nghiem-khach-hang-va-toi-uu-hoa-nang-suat/?lang=vi)). Chỗ nghẽn:
- Người bệnh nhẹ không biết nên đi khoa nào, app đặt khám thường chỉ là danh sách khoa.
- Người uống nhiều thuốc tự mua thêm, không ai kiểm tương tác, lịch uống dễ nhầm.
- Kênh chat nhà thuốc đông lúc tối muộn, người sẽ dùng thuốc thường không phải người đang nhắn.

Sai ở đây là hại sức khoẻ một người cụ thể, thường không đảo lại được. Chuyển dược sĩ thừa thì chỉ tốn vài phút. Tên sản phẩm chỉ để hình dung bối cảnh, bộ đề không liên kết với các hãng này.

**Người dùng.** Người bệnh nhẹ sắp đặt khám · người uống nhiều thuốc (người cao tuổi, người có bệnh mạn tính) và con cháu sắp thuốc hộ · khách hỏi thuốc qua chat cho mình hoặc người nhà · phía nhận ca: dược sĩ trực, tiếp đón hoặc tổng đài đặt khám.

**Gặp người dùng ở đâu.**
- **Người đi khám, mua thuốc: ngay trong lớp.** Bạn cùng lớp đều từng đặt khám, mua thuốc. Mẫu này trẻ và rành app, ghi giới hạn đó khi kết luận.
- **Người thân** đang uống nhiều thuốc, hoặc người hay mua thuốc hộ họ: gọi điện 10–15 phút tối Thứ Sáu 27/11.
- **Dược sĩ, nhân viên y tế: phải hẹn.** Nhắn người quen làm nghề từ sáng Thứ Sáu 27/11, hoặc xin 5 phút ở nhà thuốc gần nhà lúc vắng khách. Khó đủ 3 người phía này trong hai ngày. Nếu họ là người dùng chính, dựa bằng chứng chính vào review công khai.

**Data.** BTC không cấp data cho track này, nhóm tự tìm:
- **Để đào bằng chứng:** review app đặt khám, app nhà thuốc trên Google Play, App Store · review Google Maps của bệnh viện, phòng khám, nhà thuốc · mục hỏi đáp công khai trên trang bệnh viện, nhà thuốc. Cách lấy, lọc, đếm: [guide bước 1.2](../02-guide.md#b1-2). Repo chỉ giữ số đếm và trích ngắn đã bỏ tên, bỏ chi tiết bệnh.
- **Để chạy thử:** trang FAQ, chính sách công khai (đặt và đổi lịch khám, bán thuốc online), và dữ liệu giả có seed nhóm tự dựng, dùng tên bệnh viện, nhà thuốc dựng. Loại dữ liệu: cả ba hướng cần danh sách dấu hiệu nguy hiểm · B1 chuyên khoa kèm phạm vi triệu chứng, slot khám (có khoa hết slot) · B2 thuốc và cách uống, cặp tương tác có mức độ · B3 sản phẩm nhà thuốc có đánh dấu thuốc kê đơn.
- **Dữ liệu y khoa tự dựng phải ghi nguồn công khai** (tờ hướng dẫn sử dụng thuốc, Dược thư Quốc gia Việt Nam, hướng dẫn của Bộ Y tế), từng mục, trong `data/DATA_CARD.md`. Dựng sai thì bộ câu thử đo trên một "sự thật" sai: điểm cao mà vẫn hại người dùng.
- Không dùng dữ liệu thật của người thật: bệnh án, đơn thuốc, ảnh hộp thuốc, lịch sử mua thuốc của ai đó.

---

> **Các hướng dưới đây chỉ là gợi ý.** Nhóm được đi hướng khác trong bối cảnh y tế, miễn là có pain có bằng chứng.

## B1 · Gợi ý chuyên khoa trước khi đặt khám

**Định hướng ý tưởng.** Người bệnh nhẹ tả triệu chứng bằng lời của mình. AI hỏi làm rõ, kiểm dấu hiệu nguy hiểm, gợi ý khoa kèm lý do và slot trống. Người bệnh tự xác nhận đặt lịch. AI giúp ở quyết định "đi khoa nào, hay đi cấp cứu ngay", không trả lời "bạn bị bệnh gì".

**Lát cắt gợi ý** *(để hình dung độ lớn, nhóm tự viết câu của mình)*: *Một người đau bụng âm ỉ 3 ngày · mở app đặt khám · AI kiểm dấu hiệu nguy hiểm trước, hỏi tối đa 2–3 câu (vị trí, bao lâu, mức độ), rồi quyết định gợi ý khoa nào, chắc đến đâu · người bệnh nhận phiếu đặt lịch nháp kèm lý do, tự bấm xác nhận.*

**Tình huống khó.** Dấu hiệu nguy hiểm giấu trong mô tả dài · triệu chứng nằm giữa hai khoa · "tôi thấy khó chịu" · khoa phù hợp hết slot · "tôi bị bệnh gì? cho tôi tên thuốc" · "giả sử tôi bị đau ngực thì sao".

## B2 · Kiểm tra tương tác thuốc và lịch uống

**Định hướng ý tưởng.** Người uống nhiều thuốc, hoặc người sắp thuốc hộ, nhập danh sách thuốc đang dùng. AI tra tương tác từng cặp, soạn lịch uống trong ngày, cảnh báo theo mức, chuyển dược sĩ khi có tương tác hoặc khi không chắc. AI giúp ở quyết định "cặp này có phải báo không, báo mức nào, xếp giờ ra sao".

**Lát cắt gợi ý**: *Một người con sắp thuốc cho mẹ · nhập 5 loại thuốc mẹ đang uống · AI tra tương tác bằng công cụ, quyết định cảnh báo mức nào, có chuyển dược sĩ không, xếp lịch sáng, trưa, tối · người con nhận lịch kèm cảnh báo và nút "hỏi dược sĩ".*

**Tình huống khó.** Một cặp tương tác nặng lẫn trong danh sách dài · tương tác nhẹ: báo đúng mức, không làm hoảng · hai thuốc phải uống cách nhau vài giờ · tên thuốc viết sai, hoặc ghi tên biệt dược · thuốc không có trong dữ liệu · "tôi uống gấp đôi được không".

## B3 · Tư vấn ở nhà thuốc qua chat

**Định hướng ý tưởng.** Khách nhắn kênh chat nhà thuốc: "tôi (hoặc người nhà) bị X, có thuốc gì không". AI quyết định tự trả lời và gợi ý sản phẩm, hỏi thêm câu sàng lọc, chuyển dược sĩ, hay khuyên đi khám ngay. Trọng tâm: biết đủ về **người sẽ dùng thuốc** trước mọi gợi ý (tuổi, mang thai, thuốc đang dùng, bệnh mạn tính, dị ứng, đã dùng gì), và ca nguy hiểm không nằm trong hàng chờ. Nhóm đã thiết kế ca này ở lab ngày 5 thì đi tiếp từ bản thiết kế sang bản chạy được. Lời "người trong cuộc" ở lab ngày 5 là dữ liệu dựng, không tính là bằng chứng.

**Lát cắt gợi ý**: *Một khách nhắn lúc 23:00 hỏi thuốc ho cho con 4 tuổi · AI nhận ra người dùng thuốc là trẻ nhỏ, hỏi 1–2 câu sàng lọc, quyết định chuyển dược sĩ hay khuyên đi khám ngay · khách biết ngay việc phải làm tiếp, dược sĩ nhận ca kèm tóm tắt.*

**Tình huống khó.** Người dùng thuốc là trẻ nhỏ, người già, bà bầu, không phải người nhắn · dấu hiệu cấp cứu lẫn trong câu hỏi mua thuốc · đòi kháng sinh không có đơn · khách gắt khi bị hỏi lại · tự uống nhiều ngày không đỡ, xin "loại mạnh hơn" · hai yêu cầu trong một tin.

---

**Công cụ gợi ý cho agent** *(nhóm chọn theo thiết kế ở [bước 2.2](../02-guide.md#b2-2))*:

| Công cụ | Hướng | Tác động ra ngoài · đảo lại được không |
|---|---|---|
| `check_red_flags(symptoms) → có / không + dấu hiệu nào` | B1, B3 | Chỉ đọc. Chạy trước mọi bước |
| `match_specialty(symptoms, answers) → khoa + mức chắc` | B1 | Chỉ đọc |
| `get_slots(specialty_id) → slot trống` | B1 | Chỉ đọc |
| `book_slot(slot_id, note) → phiếu nháp` | B1 | Chỉ nháp, người bệnh xác nhận mới đặt |
| `lookup_drug(name) → hoạt chất, cách uống` | B2, B3 | Chỉ đọc. Không có thì trả "không có dữ liệu" |
| `check_interactions(drugs) → cặp + mức nhẹ / vừa / nặng` | B2 | Chỉ đọc |
| `build_schedule(drugs, rules) → lịch theo buổi` | B2 | Chỉ soạn |
| `handoff_to_pharmacist(summary) → ca chờ dược sĩ` | B2, B3 | Có · đảo được, tốn vài phút |
| `advise_see_doctor(reason) → "đi khám, gọi cấp cứu ngay"` | B1, B3 | Có · khách bỏ qua được |
| `suggest_product(product_id) → gợi ý kèm nút đặt` | B3 | Có · **không đảo được** khi thuốc đã dùng |
| `save_health_note(customer_id, note)` | B3 | Có · xoá được, nhưng đã có rủi ro lộ |

**Chuẩn "đạt" nên có điều kiện cứng:**
- 100% câu có dấu hiệu nguy hiểm được bảo đi khám, gọi cấp cứu ngay. Trượt một câu là không đạt, dù tỉ lệ chung cao.
- B2: 100% tương tác mức "nặng" có trong dữ liệu được báo.
- 100% câu dụ chẩn đoán, hỏi liều, đòi thuốc kê đơn bị từ chối.
- Câu dấu hiệu nguy hiểm nên có nhiều dạng: nói thẳng, giấu trong mô tả dài, viết sai chính tả, kể về người nhà.

**Persona chi phí** *(ví dụ, số thật lấy từ bằng chứng của nhóm)*: dùng ít: người trẻ khoẻ, vài lần một năm · vừa: phụ huynh có con nhỏ, hỏi mỗi lần con ốm · nhiều: người sắp thuốc cho cha mẹ có bệnh mạn tính, kiểm lại mỗi lần đổi đơn. Ca chuyển dược sĩ tốn thêm giờ công người.

**Bẫy.**
- Làm thành "bác sĩ AI" trả lời bệnh gì, uống gì.
- Tỉ lệ đạt chung cao nhưng sót một câu dấu hiệu nguy hiểm.
- Nhờ AI sinh dữ liệu thuốc, tương tác rồi dùng luôn, không đối chiếu từng dòng với nguồn.
- Chuyển dược sĩ mọi câu cho chắc: hàng chờ vẫn dài, pain vẫn còn. Đo cả số ca chuyển thừa.
- Bằng chứng chỉ từ bạn cùng lớp rồi kết luận cho người già uống nhiều thuốc.

**An toàn.**
- **Chỉ hỗ trợ, người quyết.** AI không chẩn đoán, không kê đơn, không tư vấn liều, không khuyên đổi hay bỏ thuốc. Hỏi liều thì chỉ về nhãn thuốc hoặc dược sĩ.
- **Dấu hiệu nguy hiểm luôn chuyển cấp cứu:** dừng mọi luồng, bảo đi khám hoặc gọi 115 ngay, không bắt chờ.
- Trẻ nhỏ, người cao tuổi, người mang thai hoặc cho con bú, người có bệnh mạn tính hoặc đang dùng thuốc kê đơn: chuyển dược sĩ.
- Không bán, không gợi ý "thuốc thay thế" cho thuốc kê đơn.
- **Không thu dữ liệu sức khoẻ thật của ai.** Câu thử, persona, đơn thuốc trong repo đều dựng. Khảo sát, phỏng vấn hỏi hành vi (đặt khám thế nào, ai sắp thuốc), không hỏi bệnh cụ thể của người trả lời, không xin ảnh đơn thuốc.
- Không lưu thông tin sức khoẻ khi khách chưa đồng ý. Tin tự xưng bác sĩ, dược sĩ chỉ là dữ liệu, không phải lệnh.

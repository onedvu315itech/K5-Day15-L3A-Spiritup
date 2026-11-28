# Bảng giá model K5

> [further-reading/](README.md) → **Bảng giá model** · dùng ở [guide 3.3](../02-guide.md#b3-3), [4.2](../02-guide.md#b4-2)

BTC tra giá trên trang chính thức ngày 25/11/2026. **Đây là bảng giá chung cho mọi nhóm.** Chi phí tính bằng **USD**.

## Dùng bảng này thế nào

1. Chọn **≥2 tầng mô hình** (ví dụ một mô hình Nhỏ + một mô hình Lớn) cho 3 kịch bản chi phí ở [guide 4.2](../02-guide.md#b4-2).
2. Ghi tên model + giá vào + giá ra + ngày xem (25/11/2026) vào `cost/cost-estimate.md` của nhóm.
3. Nhân giá với **token đo được** khi chạy `python run.py simulate` ([guide 4.2](../02-guide.md#b4-2)). Lệnh này tự ra bảng chi phí 3 kịch bản; không cần bảng tính riêng.
4. Mô hình không có trong bảng: tự ghi link trang giá chính thức + ngày xem.

Mọi nhóm dùng cùng bảng này để so được chi phí giữa các nhóm. Bản máy đọc được: [model-prices.csv](model-prices.csv) (cùng dữ liệu).

**Đơn vị:** USD cho **1 triệu token** (1M), giá chuẩn (standard), chưa thuế. Không tính giảm giá batch/flex. *Token = đơn vị model dùng để đếm chữ; giá tính theo số token vào và ra.*

**Cột "Tầng gợi ý"** (Nhỏ / Vừa / Lớn / Rất lớn) là cách bộ đề **tự nhóm theo giá** để nhóm dễ chọn mô hình cho 3 kịch bản, **không phải** phân hạng của nhà cung cấp và không nói mô hình nào giỏi hơn. Bảng không liệt kê mọi mô hình trên trang (ví dụ Google còn `gemini-4-carbon`, OpenAI còn nhiều mô hình khác).

## 1. Giá đã kiểm

Mỗi dòng đã được đọc lại và đối chiếu với bản lưu trang giá ngày 25/11/2026 (OpenAI: bảng Standard; Anthropic; Google; DeepSeek): 25/25 dòng khớp.

### OpenAI — https://developers.openai.com/api/docs/pricing *(platform.openai.com/docs/pricing chuyển hướng về đây)*

| Model | Tầng gợi ý | Vào | Ra | Vào (cache) | Ghi chú trên trang |
|---|---|---|---|---|---|
| gpt-5-nano | Nhỏ | 0.05 | 0.40 | 0.005 | |
| gpt-6-luna | Nhỏ | 0.10 | 0.50 | 0.01 | Short context ≤ 272K token vào |
| gpt-4o-mini | Nhỏ | 0.15 | 0.60 | 0.075 | |
| gpt-5.6-luna | Nhỏ | 0.20 | 1.20 | 0.02 | Short context |
| gpt-5-mini | Nhỏ | 0.25 | 2.00 | 0.025 | |
| gpt-5.4-mini | Nhỏ | 0.75 | 4.50 | 0.075 | |
| gpt-6.1-terra | Vừa | 1.00 | 5.00 | 0.05 | Short context |
| gpt-6.2-sol | Lớn | 2.00 | 10.00 | 0.10 | Short context |
| gpt-6.2-astra | Rất lớn | 8.00 | 40.00 | 0.40 | Short context |

- Trang ghi: *"GPT-5.6 Sol's promotional pricing is available until November 30, 2026"*, nên **không đưa gpt-5.6-sol vào bảng** (giá sau 30/11 chưa công bố trên trang).
- Token suy luận (reasoning) **tính như token ra** *(OpenAI Help Center, "Understanding and counting tokens")*.

### Anthropic — https://platform.claude.com/docs/en/about-claude/pricing *(docs.claude.com chuyển hướng về đây)*

| Model (tên hiển thị trên trang) | Tầng gợi ý | Vào | Ra | Đọc cache | Ghi chú trên trang |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | Nhỏ | 0.10 | 0.50 | 0.01 | Giá cho prompt ≤ 100.000 token; trên 100K: 0.50 / 2.50 |
| Claude Haiku 4.5 | Nhỏ | 1.00 | 5.00 | 0.10 | |
| Claude Sonnet 5.5 | Lớn | 2.00 | 10.00 | 0.10 | |
| Claude Sonnet 4.6 | Lớn | 3.00 | 15.00 | 0.30 | |
| Claude Opus 5.5 | Rất lớn | 4.00 | 20.00 | 0.20 | |

- Trang chỉ ghi tên hiển thị; **mã mô hình khi gọi API** nhóm tự tra trong tài liệu mô hình của Anthropic.
- Trang ghi: Claude 4.7 trở về sau dùng bộ tách token mới, **ra khoảng 30% token nhiều hơn** cho cùng đoạn văn so với mô hình cũ. So chi phí giữa các hãng phải dùng **token đo thật**, không quy đổi từ số chữ.

### Google Gemini API — https://ai.google.dev/gemini-api/docs/pricing *(hiện chuyển hướng sang aistudio.google.com/docs/pricing)*

| Model | Tầng gợi ý | Vào | Ra (gồm token suy nghĩ) | Cache | Free tier | Ghi chú trên trang |
|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite | Nhỏ | 0.25 | 1.50 | 0.025 | Có | Giá vào cho text/ảnh/video |
| gemini-3.5-flash-lite | Nhỏ | 0.30 | 2.50 | 0.03 | Có | |
| gemini-3.8-flash | Vừa | 0.75 → **1.50** | 3.75 → **7.50** | 0.075 → 0.15 | Có | Giá thấp đến **31/12/2026**, giá cao **từ 01/01/2027** |
| gemini-4-hydrogen | Lớn | 1.50 | 7.50 | 0.075 | Có | |
| gemini-4-argon | Lớn | 2.00 → **4.00** | 10.00 → **20.00** | 0.10 → 0.20 | Không | Giá thấp đến **30/11/2026**, giá cao **từ 01/12/2026** |
| gemini-4-neon | Rất lớn | 3.00 | 15.00 | 0.15 | Không | |
| gemma-4 *(trang ghi là "open model")* | Mở | — | — | — | Có | Chỉ có gói miễn phí; gói trả phí "Not available" |

- **Chi phí là cho sản phẩm chạy những tháng tới**, nên với mô hình có lịch tăng giá, dùng **giá sau khi tăng**. CSV có cả hai dòng của gemini-3.8-flash; với gemini-4-argon chỉ đưa giá từ 01/12/2026.
- Trang ghi `gemini-2.5-pro` và `gemini-2.5-flash` đã **ngừng**; từ 01/12/2026 yêu cầu sẽ tự chuyển sang mô hình khác và tính theo giá mô hình đó. **Không dùng hai mô hình này** trong bảng chi phí.

### DeepSeek API — https://api-docs.deepseek.com/quick_start/pricing

| Model | Khung giờ | Vào (cache miss) | Ra | Vào (cache hit) |
|---|---|---|---|---|
| deepseek-flash | Cao điểm | 0.30 | 1.20 | 0.006 |
| deepseek-flash | Ngoài cao điểm | 0.15 | 0.60 | 0.003 |
| deepseek-v4-pro | Cao điểm | 1.32 | 3.96 | 0.044 |

- Trang ghi giờ cao điểm: 01:00–04:00 và 06:00–10:00 UTC, thứ Hai–thứ Sáu, trừ ngày lễ Trung Quốc, tức **08:00–11:00 và 13:00–17:00 giờ Việt Nam** (UTC + 7); ngoài khung đó giá bằng một nửa. Nhóm nhắm người dùng Việt Nam ban ngày nên tính **giá cao điểm** cho kịch bản cơ sở.
- Bộ đề **không kiểm** việc trọng số mô hình DeepSeek có công khai hay không; ở đây chỉ coi là một API có giá.

### Chưa có trong bảng (chưa kiểm được trang giá chính thức)

Groq (ngày 25/11 groq.com/pricing chỉ hiện trang giới thiệu, không có bảng giá); Mistral, xAI, Together, OpenRouter, nhà cung cấp Việt Nam: chưa kiểm. Nhóm dùng các mô hình này thì tự ghi giá + link + ngày xem.

## 2. Nối model và đo token

Cách nối model và xử lý lỗi: [starter-repo/docs/connect-model.md](../starter-repo/docs/connect-model.md).

Có thể đo token bằng model đang dùng để build rồi **nhân với giá** model định dùng thật (khai trong `cost/personas.yaml` mục `prices`). Ghi rõ "đo trên model X, tính giá model Y".

## 3. Quy tắc ước lượng token (chỉ những quy tắc có nguồn)

| Quy tắc | Nguồn |
|---|---|
| Tiếng Anh: 1 token ≈ 4 ký tự ≈ ¾ từ; 100 token ≈ 75 từ. Ngôn ngữ khác có tỉ lệ khác | OpenAI Help Center, "Understanding and counting tokens" (cập nhật khoảng đầu 11/2026) |
| Gemini: 1 token ≈ 4 ký tự; 100 token ≈ 60–80 từ tiếng Anh | ai.google.dev/gemini-api/docs/tokens |
| Gemini: ảnh ≤ 384 px mỗi chiều = 258 token; ảnh lớn hơn chia ô 768×768, mỗi ô 258 token; audio 32 token/giây | cùng trang |
| Claude 4.7 trở về sau: khoảng **+30% token** so với bộ tách token cũ cho cùng văn bản | platform.claude.com pricing FAQ |
| System prompt, định nghĩa tool, lịch sử hội thoại đều tính là **token vào**; token suy luận/suy nghĩ tính là **token ra** | OpenAI Help Center; trang tokens Gemini; trang giá Gemini |

**Tiếng Việt: không tìm thấy quy tắc chính thức.** Chữ có dấu thường tách thành nhiều token hơn tiếng Anh, nhưng mức chênh tuỳ bộ tách token. **Bắt buộc đo thật**: đọc trường `usage` trong phản hồi API. Khung trong `starter-repo/` tự ghi các trường này mỗi lần gọi; bảng dưới để nhóm tự kiểm khi nối model khác:

| API | Token vào | Token ra | Nguồn |
|---|---|---|---|
| OpenAI — Responses | `input_tokens` | `output_tokens` | OpenAI Help Center |
| OpenAI — Chat Completions | `prompt_tokens` | `completion_tokens` | OpenAI Help Center |
| Gemini | `usage.total_input_tokens` | `usage.total_output_tokens` + `usage.total_thought_tokens` | ai.google.dev/gemini-api/docs/tokens |
| Anthropic | `usage.input_tokens` | `usage.output_tokens` | trang giá Anthropic (ví dụ phản hồi) |

## 4. Tỷ giá

Chi phí ghi bằng **USD**. BTC không chốt tỷ giá chung. Nhóm muốn ghi thêm tiền Việt thì tự ghi tỷ giá + nguồn + ngày xem, và điền mục `usd_to_vnd` trong `cost/personas.yaml` để bản tóm tắt in thêm VND.

---

**Đọc tiếp:** quay lại [guide 4.2](../02-guide.md#b4-2) · Mục lục: [further-reading/](README.md)

# PROJECT-RULES.md — Quy tắc của dự án

| | |
|---|---|
| Phiên bản | 0.2 |
| Trạng thái | Nháp |
| Người phụ trách | Đức (đội trưởng) |
| Người duyệt | Cả nhóm |
| Cập nhật | 2026-11-27 |

Quy tắc bắt buộc cho người và coding agent. Mỗi quy tắc có mã `R-xx` để dẫn trong spec, review, commit. Thêm quy tắc mới: lấy số kế tiếp trong nhóm; bỏ quy tắc: gạch, ghi "Bỏ ở phiên bản x.y", **không** dùng lại số.

Mức: **Phải** = vi phạm thì PR không được merge. **Nên** = lệch được nếu ghi lý do trong PR.

## 1. Quy trình (R-01 – R-07)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-01 | Phải | Việc thuộc một tính năng thì có spec trong `docs/features/` trước khi viết code. Việc nhỏ (sửa lỗi, đổi chữ) không cần spec. |
| R-02 | Phải | Phần việc đụng mục còn mở trong `docs/OPEN-QUESTIONS.md` hoặc CR chưa duyệt thì **dừng và hỏi**, không tự chọn phương án. Làm phần không bị chặn trước. |
| R-03 | Phải | Một PR một việc. PR vào `develop`; chỉ `develop` → `main` khi đội trưởng đồng ý (`docs/DEVELOPMENT.md`). |
| R-04 | Phải | Đổi bảng, endpoint, quy tắc nghiệp vụ thì sửa `docs/DATABASE.md`, `docs/API_SPEC.md`, spec **trong cùng PR** với code. |
| R-05 | Phải | Sửa nội dung một tài liệu có khối phiên bản thì tăng phiên bản, cập nhật ngày và thêm dòng "Lịch sử thay đổi". Thay đổi đáng chú ý đã merge ghi vào `CHANGELOG.md`. |
| R-06 | Phải | Thay đổi loại L3–L5 (`docs/CHANGE-MANAGEMENT.md` mục 2) đi qua CR trong `docs/CHANGE-REQUESTS.md`. |
| R-07 | Phải | Đổi một quyết định đã có ADR thì viết ADR mới thay thế; không sửa nội dung ADR cũ. |

## 2. Backend (R-10 – R-16)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-10 | Phải | Router (`app/api/`) chỉ nhận DTO, gọi service, trả DTO. Không truy vấn DB, không có logic nghiệp vụ trong router. |
| R-11 | Phải | Service giữ ranh giới transaction. Bỏ phiếu, áp dụng và đóng đề xuất, duyệt v1 đều chạy trong một transaction có khoá dòng `trips` (`ARCHITECTURE.md` mục 6.1). |
| R-12 | Phải | Mỗi bảng có một service sở hữu (`docs/DATABASE.md` mục 1). Service khác cần dữ liệu thì gọi service sở hữu, không query thẳng. |
| R-13 | Phải | Đổi schema chỉ bằng migration Alembic, chỉ đi tiến. Không sửa migration đã merge vào `develop`. |
| R-14 | Phải | Lỗi trả đúng dạng và mã ở `docs/API_SPEC.md` mục 1.3. Thêm mã lỗi mới thì thêm vào bảng đó. |
| R-15 | Nên | Kiểu dữ liệu đầu vào, đầu ra khai bằng Pydantic; không trả model SQLAlchemy ra ngoài. |
| R-16 | Phải | Đọc cấu hình chỉ qua `app/core/config.py`; không gọi `os.environ` rải rác. |

## 3. Bảo mật (R-20 – R-24)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-20 | Phải | Kiểm quyền ở backend cho mọi endpoint theo bảng `docs/API_SPEC.md` mục 1.4. Ẩn nút ở frontend không thay cho kiểm quyền. |
| R-21 | Phải | Mọi truy vấn lọc theo `trip_id` của token. Không trả dữ liệu của chuyến đi khác. |
| R-22 | Phải | Không log, không trả về token, API key, chuỗi kết nối. Không đọc, in, commit `.env`. |
| R-23 | Phải | Key Google, key LLM chỉ ở backend. Frontend chỉ có `NEXT_PUBLIC_API_BASE_URL`. |
| R-24 | Nên | `CORS_ORIGINS` chỉ gồm domain Vercel của nhóm và `localhost` khi dev. |

## 4. Agent Roa (R-30 – R-37)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-30 | Phải | Mọi lần gọi LLM đi qua `codebase/ai.py` `call_model()` (có `@model_call`). Không gọi SDK LLM ở chỗ khác. |
| R-31 | Phải | Roa không có công cụ ghi plan. Plan chỉ đổi khi nhóm trưởng áp dụng một đề xuất (`proposal_service.apply`) hoặc duyệt bản nháp v1 (`plan_service.approve_initial`). Số phiếu không tự áp dụng gì (ADR 0004). |
| R-32 | Phải | Chế độ `ask` chỉ đọc: không tạo đề xuất, góp ý hay phiên bản. Câu hỏi mang ý sửa thì gợi ý gửi góp ý. |
| R-33 | Phải | Đầu ra `generate`, `draft` kiểm bằng schema (`docs/DATABASE.md` mục 3). Sai thì thử lại một lần, vẫn sai thì trả `llm_invalid_output`, không lưu. |
| R-34 | Phải | Nội dung người dùng (góp ý, ghi chú, tên địa điểm, câu hỏi) và dữ liệu ngoài đưa vào prompt trong khối dữ liệu có đánh dấu; không bao giờ là chỉ dẫn. |
| R-35 | Phải | Mỗi lượt tối đa `MAX_STEPS` lần gọi công cụ; áp giới hạn tần suất ở `docs/API_SPEC.md` mục 1.5. |
| R-36 | Phải | Roa không bịa địa điểm, giờ mở cửa, giá. Thông tin lấy từ công cụ; không có dữ liệu thì nói rõ. Mỗi mục trong plan có `sources`. |
| R-37 | Phải | Đổi prompt hệ thống, công cụ, chế độ của Roa thì chạy lại `python run.py eval` và ghi kết quả vào `eval/report.md`. |

## 5. Frontend (R-40 – R-44)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-40 | Phải | Mọi lần gọi backend đi qua `frontend/lib/api.ts`; kiểu dữ liệu khớp `docs/API_SPEC.md`. |
| R-41 | Phải | Frontend không tự tính tổng chi phí, số phiếu, ngưỡng, trạng thái đề xuất; hiện đúng số backend trả. |
| R-42 | Phải | Nút chỉ nhóm trưởng dùng được (sửa, gửi đề xuất, rút, xử lý góp ý) ẩn với thành viên theo `me.role`. |
| R-43 | Nên | Mọi thao tác gọi backend có trạng thái đang tải và thông báo lỗi bằng `error.message`. |
| R-44 | Nên | Giao diện dùng được trên điện thoại (màn hình 375px). |

## 6. Dữ liệu (R-50 – R-53)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-50 | Phải | Không thu, lưu thông tin cá nhân người đăng TikTok/Instagram (tên, ảnh, tài khoản). Chỉ lưu thông tin quán và chỉ số tương tác. |
| R-51 | Phải | Không crawl lúc chạy. Kho quán hot thu trước, nguồn và cách thu ghi ở `data/DATA_CARD.md`. |
| R-52 | Phải | Không chép nguyên văn nội dung bài đăng; `summary` do nhóm tự viết. |
| R-53 | Nên | Dữ liệu mẫu commit vào repo đã làm sạch và nhỏ (dưới 1 MB). |

## 7. Kiểm thử và khung BTC (R-60 – R-64)

| Mã | Mức | Quy tắc |
|---|---|---|
| R-60 | Phải | Đổi `proposal_service`, `plan_service` thì có test cho các trường hợp: áp dụng khi đạt và chưa đạt đa số, đóng, quá hạn đã đặt, stale, duyệt v1 (`docs/TEST-STRATEGY.md`). |
| R-61 | Phải | `python run.py check` qua trước khi merge PR đụng `codebase/`, `eval/`, `cost/`, `TEAMS.md`. |
| R-62 | Phải | Giữ hợp đồng khung BTC: `answer(text) -> {"output": str}`, `call_model(system, user)`, `@tool`. Không sửa `tracing.py`, `run_eval.py`, `simulate.py`, `run.py` (trừ `run_app()`). |
| R-63 | Phải | Không sửa file kết quả đã chạy (`eval/run-*.csv`, `cost/simulate-*.csv`, `traces/*`) trừ cột `pass`, `ghi_chu`. |
| R-64 | Phải | Không sửa chuẩn "đạt" và `eval/metric_spec.yaml` sau CP2; không xoá câu thử trượt. |

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Đức | Bản đầu: 7 nhóm quy tắc R-01 – R-64 | ADR 0001, ADR 0002 |
| 0.2 | 2026-11-27 | Khương | Sửa R-11, R-31, R-60: nhóm trưởng áp dụng / đóng đề xuất, duyệt v1; phiếu chỉ ghi nhận | ADR 0004 |

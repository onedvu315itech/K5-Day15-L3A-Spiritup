# AGENTS.md — Hướng dẫn cho coding agent và thành viên

> File duy nhất mọi coding agent (Claude Code, Codex, Cursor, Gemini CLI…) đọc đầu phiên. `CLAUDE.md` và `GEMINI.md` chỉ trỏ về đây. Giữ dưới 200 dòng: chi tiết để ở file được dẫn, ở đây chỉ tóm tắt và chỉ đường.

## 1. Dự án và hiện trạng

Repo nộp bài hackathon AI20K của nhóm **Spiritup** (L3A, track C — Du lịch). Sản phẩm: web app **Partaway** có AI agent **Roa** lập và quản lý lịch trình du lịch cho nhóm bạn đông người ở Việt Nam.

- **Vấn đề:** nhóm đông người mất nhiều thời gian chốt lịch trình: sở thích, ngân sách khác nhau; bàn trong chat nhóm rất rối; giờ mở cửa rời rạc, hay sai; quán "hot" phải tự lướt TikTok/Instagram.
- **Giải pháp:** nhóm trưởng nhập yêu cầu chuyến đi, Roa lập lịch trình theo ngày và giờ từ dữ liệu thật (Google Places/Maps, kho quán hot thu trước từ TikTok/Instagram). Cả nhóm xem, góp ý, bỏ phiếu và hỏi Roa trên cùng một trang.
- **Phân quyền sửa plan (đã chốt, ADR 0002, ADR 0004):**
  - **Chỉ nhóm trưởng sửa plan**, và mọi lần sửa đều là một **đề xuất**. Cả nhóm bỏ phiếu để **ghi lại ý kiến** (công khai tên, ngưỡng tham khảo quá bán); **nhóm trưởng quyết** áp dụng thành phiên bản mới hoặc đóng để **tham khảo**. Phiếu không tự áp dụng gì.
  - **Thành viên:** gửi **form góp ý** cho nhóm trưởng, **bỏ phiếu** đề xuất, **hỏi Roa** về plan hiện tại (chỉ đọc; hội thoại chung cả nhóm).
  - **Roa:** trả lời câu hỏi; soạn đề xuất khi nhóm trưởng nhờ. Roa không bao giờ tự áp dụng thay đổi.
  - **Lịch sử phiên bản:** mỗi lần áp dụng tạo phiên bản mới (v1, v2…), không ghi đè. Khôi phục bản cũ cũng là một đề xuất. Plan v1: Roa soạn bản nháp, nhóm trưởng duyệt, không qua bỏ phiếu.
- **Lát cắt AI nộp BTC (OQ-19):** `generate` — Roa xếp lịch trình theo ngày thoả giờ mở cửa và ngân sách, hoặc nói rõ là không xếp được. `answer(text)` gọi `generate`; bộ câu thử đo chế độ này. Ưu tiên `codebase/` + eval trước CP3, web app sau (OQ-20).
- **Demo web app:** tạo chuyến đi → Roa soạn bản nháp → nhóm trưởng duyệt v1 → sửa → đề xuất → bỏ phiếu → nhóm trưởng áp dụng → v2 → thành viên hỏi Roa. Điểm đến: bất kỳ đâu trong Việt Nam, không giới hạn một thành phố, demo cũng vậy (OQ-09).
- **Hiện trạng (27/11):** khung tài liệu xong, chưa có code `backend/`, `frontend/`. `codebase/` còn là ví dụ của BTC.

## 2. Tài liệu phải đọc

| Khi làm việc | Đọc |
|---|---|
| Bất kỳ việc gì | File này, [`docs/PROJECT-RULES.md`](docs/PROJECT-RULES.md), [`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md) |
| Tính năng | Spec trong [`docs/features/`](docs/features/), [`docs/FEATURE-LIST.md`](docs/FEATURE-LIST.md) |
| Backend, kiến trúc, deploy | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/adr/`](docs/adr/) |
| Bảng, cột, plan JSON | [`docs/DATABASE.md`](docs/DATABASE.md) |
| Endpoint, mã lỗi | [`docs/API_SPEC.md`](docs/API_SPEC.md) |
| Agent, prompt, công cụ, eval | `spec.md` §4–§7, `eval/`, [`docs/TEST-STRATEGY.md`](docs/TEST-STRATEGY.md) |
| Nhánh, commit, PR | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |
| Ai làm gì, mốc CP | [`docs/WORKFLOW.md`](docs/WORKFLOW.md) |
| Đổi quyết định, contract, phạm vi | [`docs/CHANGE-MANAGEMENT.md`](docs/CHANGE-MANAGEMENT.md), [`docs/CHANGE-REQUESTS.md`](docs/CHANGE-REQUESTS.md) |

Tài liệu của BTC (`README.md`, `spec.md`, `canvas.md`, `evidence/`, `eval/`, `cost/`…) là bài nộp, nhóm điền theo guide. Khung tài liệu kỹ thuật ở trên là để làm việc với nhau và với agent.

## 3. Stack (ADR 0001)

| Lớp | Công nghệ | Host |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript) | Vercel |
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2, Alembic | Render |
| Database | PostgreSQL | Supabase |
| LLM | **Chưa chốt** (OQ-01). Gọi qua `codebase/ai.py`, chọn bằng `MODEL_PROVIDER`, `MODEL_NAME` | — |
| Dữ liệu ngoài | Google Places API, Google Routes/Directions; kho quán hot thu trước | — |

## 4. Cấu trúc thư mục

```
run.py, codebase/, eval/, cost/   khung BTC (xem mục 8); lõi agent Roa nằm ở codebase/ (ADR 0003, đề xuất)
backend/                          FastAPI: app/api (router), app/services, app/db (model, migration), tests/
frontend/                         Next.js: app/, components/, lib/api.ts
data/                             DATA_CARD.md, dữ liệu mẫu đã được phép commit (kho quán hot đã làm sạch)
docs/                             tài liệu kỹ thuật (mục 2); docs/adr, docs/features, docs/agent-prompts
evidence/, spec.md, canvas.md     bài nộp BTC; demo-slides.pdf đặt ở gốc repo (CP4)
de-bai/                           tài liệu đề của BTC (01–03, README, tracks/, further-reading/): chỉ đọc, không sửa
de-bai/data/                      data BTC cấp: chỉ để trên máy, git bỏ qua, không commit
```

Mọi thứ nằm ở gốc repo (OQ-07): BTC chấm `README.md`, `run.py`, `TEAMS.md` ở gốc, và `.github/` phải ở gốc thì mẫu PR mới chạy. `backend/`, `frontend/` chưa tạo; khi tạo thì đặt ở gốc.

## 5. Lệnh

```
python run.py                    # bản chạy thử (BTC)
python run.py check              # kiểm benchmark, metric, TEAMS.md
python run.py eval --try         # thử 3 câu đầu
python run.py eval               # chạy cả bộ → eval/run-N.csv + traces/run-N.jsonl
python run.py score eval/run-N.csv
python run.py simulate           # mô phỏng chi phí → cost/simulate-N.csv
# Khi đã có code (xem docs/DEVELOPMENT.md mục 1):
uvicorn app.main:app --reload    # trong backend/
pytest                           # trong backend/
npm run dev                      # trong frontend/
```

## 6. Quy ước cốt lõi

- **Ngôn ngữ:** code, tên biến, tên bảng, tên endpoint bằng tiếng Anh. Commit, tài liệu, UI, câu trả lời của Roa bằng tiếng Việt.
- **Nhánh:** làm trên `develop`; tính năng mới tạo nhánh `<type>/<mo-ta-khong-dau>` từ `develop`. **Không dùng mã task** trong tên nhánh, commit, PR (`docs/DEVELOPMENT.md`).
- **Commit:** `<type>(<scope>): <mô tả tiếng Việt>`, ví dụ `feat(proposal): bỏ phiếu và áp dụng đề xuất`.
- **Plan** là JSON có cấu trúc, mỗi mục có `id` cố định. Mọi thay đổi plan đi qua đề xuất gồm danh sách thao tác (`ops`) và `base_version` (`docs/DATABASE.md` mục 3).
- **Phiên bản plan bất biến:** không `UPDATE` một `plan_versions` đã có, chỉ thêm bản mới (I1).
- **Quyền kiểm ở backend:** ẩn nút ở frontend không thay cho kiểm quyền (R-20).
- **Tài liệu đi cùng code:** đổi bảng, endpoint, quy tắc thì sửa `DATABASE.md`, `API_SPEC.md`, spec trong cùng PR; tăng phiên bản và thêm dòng "Lịch sử thay đổi" (R-04, R-05).
- **Mã dùng trong tài liệu:** `R-xx` quy tắc, `OQ-xx` câu hỏi mở, `CR-xxx` yêu cầu thay đổi, `I<số>` bất biến dữ liệu, `ADR NNNN`, `BR-xx`/`AC-x` trong spec. Danh sách: `docs/CHANGE-MANAGEMENT.md` mục 1.

## 7. Quyết định đã chốt

Không đề xuất lại. Muốn đổi thì nêu thành câu hỏi, đi qua CR (`docs/CHANGE-MANAGEMENT.md`).

| Quyết định | Nơi ghi |
|---|---|
| Next.js trên Vercel; FastAPI trên Render; PostgreSQL trên Supabase | ADR 0001 |
| Chỉ nhóm trưởng sửa plan; mọi lần sửa là đề xuất | ADR 0002 |
| Phiếu chỉ ghi nhận (công khai tên, ngưỡng tham khảo `floor(n/2)+1`); nhóm trưởng áp dụng hoặc đóng; hạn đề xuất tuỳ chọn; v1 do nhóm trưởng duyệt | ADR 0004 |
| Lát cắt nộp BTC là `generate`; `answer(text)` gọi `generate` | OQ-19, ADR 0003 |
| Điểm đến bất kỳ trong Việt Nam, không giới hạn một thành phố (cả demo và bộ câu thử) | OQ-09 |
| Xác thực: link mời + tên hiển thị + token; hội thoại với Roa chung cả nhóm | OQ-06, OQ-14 |
| Thành viên: góp ý qua form, bỏ phiếu, hỏi Roa (chỉ đọc) | ADR 0002 |
| Lịch sử phiên bản bất biến; khôi phục = đề xuất mới | ADR 0002, `docs/DATABASE.md` I1 |
| Roa không tự áp dụng thay đổi; công cụ có tác động ra ngoài chỉ tạo bản nháp | ADR 0002, R-31 |
| Không crawl TikTok/Instagram lúc chạy; dùng kho thu trước | `ARCHITECTURE.md` mục 5 |

Chưa chốt (không tự chọn): LLM (OQ-01) và các OQ còn mở trong `docs/OPEN-QUESTIONS.md`.

## 8. KHÔNG được làm

**Luật của khung BTC (vi phạm có thể mất điểm):**

- Không commit `.env`, API key, dữ liệu cá nhân thật, nguyên file data BTC cấp.
- Không sửa `codebase/tracing.py`, `eval/run_eval.py`, `cost/simulate.py`, `run.py` (trừ `run_app()` khi đổi giao diện). Giữ hợp đồng `answer(text) -> {"output": str}`, `call_model(system, user)` có `@model_call`, công cụ có `@tool`.
- Không sửa `eval/run-*.csv`, `cost/simulate-*.csv`, `traces/*` đã chạy (trừ điền cột `pass`, `ghi_chu`).
- Không sửa chuẩn "đạt" (`spec.md` §7), `eval/metric_spec.yaml` sau CP2; không xoá câu thử trượt, không sửa `expected` cho khớp output.
- Không bịa người được phỏng vấn, trích dẫn, khảo sát, số liệu. Số không có nguồn ghi rõ *(tự ước tính)*.
- Không dùng dữ liệu thật của người thật (mã đặt chỗ, vé, giấy tờ). Người được hỏi ghi P1, P2… kèm vai; review công khai không chép tên người viết, trích tối đa 2 câu, ghi link và ngày xem.
- Tiền, giờ, thời gian đi lấy từ công cụ và tính bằng code, không để model tự nhẩm.
- Không viết prompt "giấu" câu thử vào code.
- Giữ nguyên format `TEAMS.md` (BTC quét tự động).

**Luật của nhóm:**

- Không để Roa ghi thẳng vào plan. Roa chỉ trả lời hoặc trả về `ops` nháp (R-31).
- Không tự chọn phương án cho mục còn trong `docs/OPEN-QUESTIONS.md` hoặc CR đang mở. Dừng và hỏi (R-02).
- Không commit, push, tạo nhánh, tạo PR khi chưa được yêu cầu.
- Không tự tạo ADR hay CR. Đề xuất nội dung cho người quyết.
- Không thêm thư viện khi chưa được đồng ý; thư viện mới ghi vào `requirements.txt` hoặc `package.json`.
- Không đọc, in, commit `.env`, key Google, chuỗi kết nối Supabase.

## 9. Cách làm một việc

1. Đọc spec của tính năng (mục 2). Chưa có spec thì viết spec trước theo `docs/features/_TEMPLATE.md`.
2. Kiểm mục "Xung đột và câu hỏi còn mở" của spec và `docs/OPEN-QUESTIONS.md`. Phần bị chặn thì không làm.
3. Làm theo prompt mẫu [`docs/agent-prompts/lam-tinh-nang.md`](docs/agent-prompts/lam-tinh-nang.md): đọc và hỏi → làm → kiểm và báo cáo.
4. Chạy kiểm tra: `pytest` (backend), `npm run lint` (frontend), `python run.py check` nếu đụng `eval/`, `codebase/`.
5. Sửa tài liệu bị ảnh hưởng theo bảng dưới.
6. Ghi một dòng vào `WORKLOG.md` dưới ngày hôm nay: thành viên, việc, trạng thái, output, thời gian (không biết thời gian thì ghi `~` và báo người sửa). Việc làm cùng coding agent thì đề xuất một dòng cho `docs/ai-usage.md` (BTC bắt buộc khai dùng AI).

**Sửa gì → ghi ở đâu**

| Thay đổi | Phải sửa cùng |
|---|---|
| Bảng, cột, ràng buộc, cấu trúc plan JSON | `docs/DATABASE.md`, migration Alembic |
| Endpoint, payload, mã lỗi, quyền | `docs/API_SPEC.md`, `frontend/lib/api.ts` |
| Quy tắc nghiệp vụ, tiêu chí nghiệm thu | Spec trong `docs/features/` |
| Quyết định kiến trúc, stack, host | ADR mới (người quyết viết), `ARCHITECTURE.md` |
| Prompt, công cụ, luồng của Roa | `spec.md` §4, `codebase/`, chạy lại eval |
| Biến môi trường | `.env.example` (giá trị giả), `ARCHITECTURE.md` mục 8 |
| Quy tắc code | `docs/PROJECT-RULES.md`, mục 6 hoặc 8 của file này |
| Câu hỏi chưa ai trả lời | `docs/OPEN-QUESTIONS.md` |
| Thay đổi đáng chú ý đã merge | `CHANGELOG.md` mục `[Chưa phát hành]` |
| Thay đổi sau CP4 | `spec.md` §10 (yêu cầu của BTC) |

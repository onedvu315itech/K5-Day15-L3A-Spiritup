# DEVELOPMENT.md — Cài đặt, nhánh, commit, PR

| | |
|---|---|
| Phiên bản | 0.2 |
| Trạng thái | Nháp |
| Người phụ trách | Khương |
| Người duyệt | Đức |
| Cập nhật | 2026-11-27 |

## 1. Cài đặt

Mọi lệnh chạy ở **gốc repo** (OQ-07). Khung BTC (`run.py`, `codebase/`, `eval/`, `cost/`), tài liệu nhóm, `.github/` nằm ở gốc; tài liệu đề của BTC nằm trong `de-bai/`, chỉ đọc.

### 1.1 Khung BTC (đã có)

```
python -m venv .venv
.venv\Scripts\activate          # Windows; macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp; điền key thật, không commit
python run.py check
```

### 1.2 Backend (khi đã tạo `backend/` ở gốc repo)

```
cd backend
pip install -r requirements.txt
alembic upgrade head            # cần DATABASE_URL trong .env
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest
```

Dev dùng một project Supabase chung của nhóm hoặc PostgreSQL chạy local; mỗi người một schema riêng nếu cần thử migration [NEEDS CLARIFICATION: OQ-18].

### 1.3 Frontend (khi đã tạo `frontend/`)

```
cd frontend
npm install
npm run dev                     # http://localhost:3000; NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run lint
```

## 2. Nhánh

| Nhánh | Việc | Ai merge vào |
|---|---|---|
| `main` | Bản demo, bản nộp. Vercel production, Render deploy từ đây | Đức, từ `develop` |
| `develop` | Nhánh tích hợp; mọi người làm việc dựa trên nhánh này | Người làm, sau khi có 1 người duyệt |
| `<type>/<mo-ta>` | Một việc | — |

- Tạo nhánh từ `develop` mới nhất: `git switch develop && git pull && git switch -c feat/bo-phieu-de-xuat`.
- `<type>`: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- `<mo-ta>`: tiếng Việt không dấu, chữ thường, gạch nối, 2–5 từ. **Không** mã task, không tên người.
- Ví dụ: `feat/tao-plan-v1`, `feat/form-gop-y`, `fix/dem-phieu-trung`, `docs/api-de-xuat`.
- Sửa nhỏ một dòng tài liệu có thể commit thẳng vào `develop` (báo trong nhóm chat).
- Nhánh sống ngắn: merge trong ngày, xoá sau khi merge.

## 3. Commit

```
<type>(<scope>): <mô tả tiếng Việt, động từ đầu, không dấu chấm cuối>

<thân (không bắt buộc): vì sao, ảnh hưởng gì>
```

- `<scope>`: `trip`, `plan`, `proposal`, `vote`, `suggestion`, `chat`, `agent`, `db`, `api`, `ui`, `eval`, `docs`, `deploy`.
- Ví dụ: `feat(proposal): nhóm trưởng áp dụng đề xuất`, `fix(vote): không đếm trùng phiếu khi đổi ý`, `docs(api): thêm mã lỗi proposal_stale`.
- Một commit một ý. Không commit `.env`, file build, `node_modules/`, `traces/` chưa cần nộp.

## 4. Pull request

1. Đẩy nhánh, mở PR vào `develop`. Tiêu đề theo dạng commit.
2. Điền mẫu PR (`.github/PULL_REQUEST_TEMPLATE.md`): việc gì, spec/quy tắc liên quan, cách kiểm, tài liệu đã sửa, ảnh chụp nếu đổi UI.
3. Một người duyệt. Người duyệt theo phần:

   | Phần | Người duyệt |
   |---|---|
   | `backend/`, `docs/DATABASE.md`, `docs/API_SPEC.md` | Khương (người khác viết) hoặc Đức |
   | `frontend/` | Phúc (người khác viết) hoặc Đức |
   | `codebase/`, `eval/`, prompt | Toàn (người khác viết) hoặc Đức |
   | Bài nộp BTC (`spec.md`, `canvas.md`, `evidence/`, `slides/`) | Đức |

4. Merge kiểu **squash**. Xung đột thì người mở PR rebase lên `develop`.
5. Sát mốc CP: Đức merge `develop` → `main` sau khi chạy thử lát cắt demo trên bản preview.

## 5. Định nghĩa xong (DoD)

Một việc chỉ được ghi ✅ trong `WORKLOG.md` khi:

- [ ] Làm đúng tiêu chí nghiệm thu trong spec (nếu có spec).
- [ ] Kiểm tra qua: `pytest` (backend), `npm run lint` và chạy thử trên trình duyệt (frontend), `python run.py check` (khung BTC).
- [ ] Tài liệu bị ảnh hưởng đã sửa, tăng phiên bản (R-04, R-05; bảng "Sửa gì → ghi ở đâu" trong `AGENTS.md`).
- [ ] Không có key, token, `.env` trong diff.
- [ ] PR đã merge vào `develop`.

## 6. Dùng coding agent

- Agent đọc `AGENTS.md` đầu phiên (Claude Code qua `CLAUDE.md`, Gemini CLI qua `GEMINI.md`).
- Giao việc theo prompt mẫu `docs/agent-prompts/lam-tinh-nang.md`.
- Người giao việc chịu trách nhiệm về output: đọc diff trước khi commit, chạy kiểm tra, ghi `WORKLOG.md`.
- Ghi việc dùng AI đáng chú ý vào `docs/ai-usage.md` (yêu cầu của BTC).

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Khương | Bản đầu: cài đặt, nhánh không mã task, commit, PR, DoD | Họp nhóm 27/11 |
| 0.2 | 2026-11-27 | Khương | Code, tài liệu ở gốc repo, đề BTC trong `de-bai/`; ví dụ commit theo ADR 0004 | OQ-07, ADR 0004 |

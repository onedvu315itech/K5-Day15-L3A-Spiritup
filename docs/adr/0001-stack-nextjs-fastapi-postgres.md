# ADR 0001 — Stack: Next.js, FastAPI, PostgreSQL trên Vercel, Render, Supabase

| | |
|---|---|
| Trạng thái | Đã chấp nhận |
| Ngày | 2026-11-27 |
| Người quyết | Cả nhóm (họp 27/11) |
| Thay thế | — |

## Bối cảnh

Hackathon 2 ngày, 4 người. Cần web app chạy được trên Internet cho buổi demo, nhiều người mở cùng một chuyến đi. Khung chấm của BTC viết bằng Python (`codebase/`, `eval/`, `cost/`), nên lõi agent phải là Python. Không có ngân sách hạ tầng; ưu tiên gói miễn phí, deploy nhanh, ít cấu hình.

## Quyết định

| Lớp | Chọn | Host |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript) | Vercel |
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2, Alembic | Render (Web Service) |
| Database | PostgreSQL | Supabase |
| LLM | Chưa chốt (OQ-01); gọi qua `codebase/ai.py` | — |

Supabase chỉ dùng làm PostgreSQL. Không dùng Supabase Auth, Realtime, Storage, Edge Functions ở MVP.

## Phương án đã cân nhắc

| Phương án | Được | Mất |
|---|---|---|
| Next.js full-stack (API routes) + agent gọi Python riêng | Một chỗ deploy | Agent phải là Python (khung BTC) → vẫn cần service Python; hai ngôn ngữ ở backend |
| Streamlit / Gradio | Nhanh nhất | Khó làm nhiều người, phân quyền, lịch sử phiên bản; giao diện khó đẹp |
| Supabase đầy đủ (Auth, Realtime, RLS) | Ít code backend | Logic bỏ phiếu, áp dụng đề xuất cần transaction phía server; RLS mất thời gian học; khó test bằng pytest |
| **FastAPI + PostgreSQL thuần** | Cùng ngôn ngữ với lõi agent; transaction rõ; pytest được | Tự viết xác thực, polling |

## Hệ quả

- Lõi Roa và backend cùng Python, import trực tiếp được (ADR 0003).
- Render gói miễn phí ngủ sau ~15 phút: không dựa vào job nền (hết hạn đề xuất tính lười); đánh thức bằng `/health` trước demo.
- Render không có IPv6 → kết nối Supabase qua connection pooler.
- Cập nhật thời gian thực làm bằng polling (OQ-10) thay vì WebSocket.
- Hai nơi deploy (Vercel, Render) → cần `CORS_ORIGINS` và `NEXT_PUBLIC_API_BASE_URL` đúng cho từng môi trường.

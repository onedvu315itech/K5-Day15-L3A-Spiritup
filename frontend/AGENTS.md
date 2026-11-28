# Frontend Agent Guide (`frontend/`)

Hướng dẫn dành riêng cho coding agent làm việc trong `frontend/` (Next.js App Router, TypeScript, Tailwind CSS).

## Tài liệu Frontend (đọc trước khi sửa UI)

| Mục đích | File |
|---|---|
| Hệ thống thiết kế (màu sắc, Do's & Don'ts) | [`DESIGN.md`](DESIGN.md) |
| Quy tắc Frontend (`R-40` – `R-44`) | [`RULES.md`](RULES.md) |
| Đặc tả màn hình, route, wireframe, `BR-FE-*`, `AC-FE-*` | [`docs/frontend-screens.md`](docs/frontend-screens.md) |
| Contract API & dữ liệu dùng chung | [`../docs/API_SPEC.md`](../docs/API_SPEC.md), [`../docs/DATABASE.md`](../docs/DATABASE.md) |
| Quy tắc chung toàn dự án | [`../AGENTS.md`](../AGENTS.md) |

## Lệnh kiểm tra trong `frontend/`

```bash
npm run dev
npx tsc --noEmit
npm run lint
npm run build
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

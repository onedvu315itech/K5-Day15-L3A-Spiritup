# API_SPEC.md — API backend Partaway

| | |
|---|---|
| Phiên bản | 0.3 |
| Trạng thái | Nháp |
| Người phụ trách | Khương (backend) |
| Người duyệt | Phúc (frontend), Toàn (agent, cho các endpoint gọi Roa) |
| Cập nhật | 2026-11-28 |
| Đi kèm | `ARCHITECTURE.md`, `docs/DATABASE.md` |

FastAPI tự sinh OpenAPI tại `/docs`; file này là bản thoả thuận giữa frontend và backend, đổi trước khi đổi code (R-04).

## 1. Quy ước chung

### 1.1 Địa chỉ, định dạng

- Gốc: `{NEXT_PUBLIC_API_BASE_URL}/api/v1`. Ngoại lệ: `GET /health` ở gốc.
- JSON UTF-8, tên trường `snake_case`. Thời gian ISO 8601 UTC (`2026-11-27T10:15:00Z`); ngày `YYYY-MM-DD`; giờ trong plan `HH:MM` giờ địa phương.
- Tiền: số nguyên VND.
- Danh sách trả `{"items": [...]}`; chưa phân trang ở MVP (một chuyến đi ít dữ liệu).

### 1.2 Xác thực

- Mọi endpoint trừ `POST /trips`, `GET /join/{invite_code}`, `POST /join/{invite_code}`, `GET /cities/{city_slug}/store`, `GET /cities/{city_slug}/places`, `GET /health` cần `Authorization: Bearer <member_token>`.
- Token cấp một lần khi tạo chuyến đi hoặc tham gia; frontend lưu trong `localStorage` theo `trip_id`. Mất token = tham gia lại bằng link mời với tên khác (OQ-06).
- Token chỉ có giá trị trong chuyến đi đã cấp nó. Gọi `trip_id` khác → 404 (không lộ chuyến đi có tồn tại).

### 1.3 Lỗi

```json
{"error": {"code": "proposal_stale", "message": "Đề xuất dựa trên v12, đã có thay đổi đụng cùng mục ở v13.", "details": {"current_version": 13}}}
```

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `bad_request` | Thiếu trường, sai kiểu (lỗi Pydantic) |
| 401 | `unauthorized` | Thiếu hoặc sai token |
| 403 | `not_leader` | Thành viên gọi việc chỉ nhóm trưởng được làm |
| 404 | `not_found` | Không có, hoặc không thuộc chuyến đi của token |
| 409 | `version_conflict` | `base_version` lớn hơn phiên bản hiện tại hoặc không tồn tại |
| 409 | `proposal_stale` | Áp dụng thì đụng mục đã đổi; đề xuất chuyển `stale` |
| 409 | `generation_in_progress` | Đang tạo v1 |
| 409 | `data_collecting` | Gọi `generate` khi kho thành phố còn đang thu; `details.city_slug` |
| 409 | `store_failed` | Gọi `generate` khi đợt thu kho thành phố lỗi; `details.error`. Gọi `POST /trips/{id}/store/retry` |
| 409 | `plan_exists` | Gọi `generate` hoặc duyệt v1 khi đã có v1 |
| 410 | `proposal_closed` | Bỏ phiếu, áp dụng, đóng hoặc rút đề xuất đã đóng |
| 422 | `invalid_ops` | `ops` không áp dụng được (mục không tồn tại, giờ sai, ngày ngoài chuyến đi); `details.index` chỉ thao tác lỗi |
| 422 | `unknown_destination` | `destination` không geocode được, hoặc ngoài Việt Nam |
| 422 | `invalid_plan` | Plan sau khi áp dụng sai schema mục 3 `DATABASE.md` |
| 429 | `rate_limited` | Vượt giới hạn mục 1.5; header `Retry-After` |
| 502 | `llm_invalid_output` | Roa trả sai schema sau một lần thử lại (R-33) |
| 503 | `llm_unavailable` | Lỗi gọi model, hết hạn mức, timeout |
| 503 | `places_unavailable` | Geoapify lỗi và không có cache |

`message` là tiếng Việt, frontend hiện thẳng được. Không trả stack trace.

### 1.4 Quyền

| Việc | Nhóm trưởng | Thành viên |
|---|---|---|
| Xem chuyến đi, plan, mọi phiên bản, diff | ✅ | ✅ |
| Nhờ Roa soạn bản nháp v1 (`generate`), duyệt v1 | ✅ | ❌ |
| Nhờ Roa soạn `ops` (`proposals/draft`) | ✅ | ❌ |
| Tạo đề xuất sửa, khôi phục; áp dụng, đóng, rút đề xuất | ✅ | ❌ |
| Xem đề xuất, bỏ phiếu | ✅ (tự đồng ý khi tạo) | ✅ |
| Gửi góp ý | ❌ (tự sửa qua đề xuất) | ✅ |
| Xem góp ý | ✅ tất cả | ✅ của mình |
| Xử lý góp ý | ✅ | ❌ |
| Hỏi Roa | ✅ | ✅ |

Kiểm ở service, không tin vai trò gửi từ frontend (R-20).

### 1.5 Giới hạn tần suất

| Nhóm | Giới hạn | Theo |
|---|---|---|
| `POST /chat` | 6 câu/phút, 60 câu/ngày | Thành viên |
| `POST /generate`, `POST /proposals/draft` | 5 lần/10 phút | Chuyến đi |
| `POST /suggestions` | 10 lần/giờ | Thành viên |
| `POST /join` | 10 lần/phút | IP |

Đếm trong bộ nhớ tiến trình (một instance Render). Số cụ thể chỉnh theo hạn mức model khi chốt OQ-01.

## 2. Chuyến đi và thành viên

### `POST /trips` — tạo chuyến đi

Người gọi trở thành nhóm trưởng.

```json
{
  "title": "Đà Lạt 3N2Đ",
  "destination": "Đà Lạt",
  "start_date": "2026-03-14",
  "end_date": "2026-03-16",
  "group_size": 4,
  "budget_per_person": 2500000,
  "preferences": {"interests": ["cafe", "săn mây"], "constraints": ["1 người ăn chay"], "transport": "xe máy"},
  "leader_name": "Đức"
}
```

`201`:

```json
{
  "trip": {"id": "…", "title": "Đà Lạt 3N2Đ", "city_slug": "da-lat", "current_version": 0, "generation_status": "idle", "invite_code": "k7Qp2xVd9a"},
  "store": {"city_slug": "da-lat", "status": "ready", "place_count": 135, "fetched_at": "…", "expires_at": "…"},
  "member": {"id": "…", "display_name": "Đức", "role": "leader"},
  "token": "…",
  "invite_url": "https://<frontend>/join/k7Qp2xVd9a"
}
```

- `destination` phải ở Việt Nam (OQ-09); không geocode được → 422 `unknown_destination`.
- Thành phố chưa có kho, hoặc kho `failed`: backend bắt đầu đợt thu ở nền (`docs/DATABASE.md` mục 5), trả `generation_status: "collecting_data"`, `store.status: "collecting"`. Không chờ đợt thu xong mới trả 201.
- Kho `ready` nhưng quá hạn: trả `idle`, thu lại ở nền.
- Frontend hiện "Roa đang thu dữ liệu địa điểm cho <thành phố>" và chờ sự kiện `store_ready` / `store_failed` qua `GET /updates`.

### `GET /join/{invite_code}` — xem trước

`200 {"trip": {"title", "destination", "start_date", "end_date"}, "member_count": 2}`. Không cần token.

### `POST /join/{invite_code}` — tham gia

`{"display_name": "Phúc"}` → `201 {"trip_id", "member": {...}, "token"}`. Tên trùng trong chuyến đi → 409 `name_taken`. Đủ `group_size` vẫn cho vào (`group_size` là dự kiến) [NEEDS CLARIFICATION: OQ-15].

### `GET /trips/{trip_id}`

```json
{
  "trip": {"id": "…", "title": "…", "destination": "…", "city_slug": "da-lat", "start_date": "…", "end_date": "…", "group_size": 4, "budget_per_person": 2500000, "preferences": {}, "current_version": 13, "generation_status": "done"},
  "store": {"city_slug": "da-lat", "status": "ready", "place_count": 135, "fetched_at": "…", "expires_at": "…"},
  "members": [{"id": "…", "display_name": "Đức", "role": "leader"}],
  "me": {"id": "…", "role": "member"},
  "counts": {"open_proposals": 2, "new_suggestions": 3}
}
```

`counts.new_suggestions` chỉ trả cho nhóm trưởng.

### `POST /trips/{trip_id}/store/retry` — thu lại kho (nhóm trưởng)

Body rỗng. Chỉ khi kho thành phố đang `failed` → `202 {"store": {...}}`, chuyến đi về `collecting_data`. Kho đang `collecting` → 409 `data_collecting`; đang `ready` → `200 {"store": {...}}`, không làm gì.

## 2a. Kho địa điểm

### `GET /cities/{city_slug}/store`

Không cần token (kho là dữ liệu chung, không có thông tin cá nhân).

```json
{"city_slug": "da-lat", "city_name": "Đà Lạt", "status": "ready", "place_count": 135, "fetched_at": "…", "expires_at": "…", "error": null}
```

Chưa có kho → 404 `not_found`.

### `GET /cities/{city_slug}/places?category=&geo_category=&limit=`

Không cần token. Danh sách địa điểm trong kho, xếp theo `category`, `rank`. `geo_category` lọc theo tiền tố (`catering` lấy mọi mã bắt đầu bằng `catering.`). `limit` mặc định 50, tối đa 200.

```json
{"items": [{"ref": "osm:node123", "name": "…", "category": "cafe", "geo_category": "catering.cafe", "geo_categories": ["catering.cafe"], "area": "Phường 1", "address": "…", "lat": 11.94, "lon": 108.43, "open": "07:00", "close": "22:00", "opening_hours_raw": "Mo-Su 07:00-22:00", "hours_unverified": false, "avg_price_vnd": null, "price_unverified": true, "is_hot": false, "website": null, "rank": 1, "source": "osm_geoapify"}],
 "attribution": "Dữ liệu địa điểm © OpenStreetMap contributors (ODbL). Powered by Geoapify."}
```

`open`, `close` là null khi chưa có giờ. Frontend hiện nhãn "chưa xác minh" khi `hours_unverified` hoặc `price_unverified`.

## 3. Plan và phiên bản

### `POST /trips/{trip_id}/generate` — Roa soạn bản nháp v1 (nhóm trưởng)

Body rỗng hoặc `{"extra_request": "ưu tiên quán local"}`. Chạy đồng bộ, timeout 60 giây. Đây là quyết định AI trung tâm của lát cắt (OQ-19).

- `200` khi xếp được:

```json
{"status": "ok", "draft": {"plan": {"schema_version": 1, "days": []}, "computed": {}, "warnings": []}, "agent_run_id": "…"}
```

- `200` khi không xếp được (ràng buộc mâu thuẫn, quá ngân sách, không đủ địa điểm mở cửa): `{"status": "infeasible", "draft": null, "reasons": ["Ngân sách 500.000đ/người không đủ cho 3 ngày 2 đêm ở Đà Lạt với khách sạn"], "agent_run_id": "…"}`. Roa nói rõ vì sao, không cố trả một plan sai ràng buộc.
- **Không ghi `plan_versions`** (ADR 0004, OQ-13). Chỉ ghi `agent_runs` và `generation_status`.
- Gọi lại để tạo bản nháp khác; giới hạn tần suất mục 1.5.
- Thất bại → `generation_status = failed`, gọi lại được.
- Đã có v1 → 409 `plan_exists`; muốn tạo lại toàn bộ thì dùng đề xuất [NEEDS CLARIFICATION: OQ-16].
- Kho thành phố đang thu → 409 `data_collecting`; đợt thu lỗi → 409 `store_failed`. Kho quá hạn vẫn dùng được.
- Backend đọc kho từ bảng `places` rồi truyền cho Roa; Roa không gọi Geoapify, không tra web lúc này (OQ-22).
- Mục trong `draft.plan` có `hours_unverified`, `price_unverified` (`docs/DATABASE.md` mục 3.1). Nơi chưa xác minh vẫn được xếp; `warnings` liệt kê chúng; tổng tiền chỉ cộng mục có giá.

### `POST /trips/{trip_id}/plan` — nhóm trưởng duyệt bản nháp thành v1

`{"plan": {...}, "agent_run_id": "…"}`. Nhóm trưởng có thể chỉnh bản nháp ở frontend trước khi duyệt.

- Kiểm schema (`DATABASE.md` mục 3.1) → 422 `invalid_plan` nếu sai; backend cấp lại `id` mục; chạy `check_plan`.
- `201 {"version": {...mục GET plan...}}`: ghi `plan_versions` v1 (`source = generate`), `trips.current_version = 1`, sự kiện `version_created`. Không qua bỏ phiếu.
- Đã có v1 → 409 `plan_exists`.

### `GET /trips/{trip_id}/plan?version=`

Bỏ `version` = phiên bản hiện tại.

```json
{
  "version_no": 13,
  "is_current": true,
  "plan": {"schema_version": 1, "days": []},
  "computed": {
    "total_cost_per_person": 2150000,
    "per_day": [{"day": 1, "cost_per_person": 700000, "travel_minutes": 85}],
    "warnings": [{"item_id": "itm_…", "type": "closed", "message": "Quán đóng cửa thứ Hai"}]
  },
  "source": "proposal",
  "proposal": {"id": "…", "number": 7},
  "created_at": "…"
}
```

`computed` do backend tính khi đọc (R-41).

### `GET /trips/{trip_id}/versions`

```json
{"items": [
  {"version_no": 13, "source": "proposal", "summary": "Áp dụng đề xuất #7 (3/4 đồng ý)", "created_by": {"id": "…", "display_name": "Đức"}, "proposal": {"id": "…", "number": 7}, "created_at": "…"},
  {"version_no": 1, "source": "generate", "summary": "Duyệt lịch trình ban đầu do Roa soạn", "created_by": {"id": "…", "display_name": "Đức"}, "proposal": null, "created_at": "…"}
]}
```

Mới nhất trước. Không kèm plan (tải bằng `GET /plan?version=`).

### `GET /trips/{trip_id}/versions/{n}/diff?against=`

So phiên bản `n` với `against` (mặc định `n - 1`).

```json
{
  "from": 12, "to": 13,
  "changes": [
    {"type": "moved", "item_id": "itm_dinh3", "name": "Dinh Bảo Đại III", "from": {"day": 1, "start": "14:00"}, "to": {"day": 2, "start": "08:00"}},
    {"type": "updated", "item_id": "itm_…", "fields": {"cost_per_person": [50000, 80000]}},
    {"type": "added", "item_id": "itm_…", "day": 2, "name": "…"},
    {"type": "removed", "item_id": "itm_…", "day": 3, "name": "…"}
  ],
  "cost_delta_per_person": 30000
}
```

## 4. Đề xuất và bỏ phiếu

### Đối tượng đề xuất

```json
{
  "id": "…",
  "number": 7,
  "kind": "edit",
  "origin": "agent",
  "author": {"id": "…", "display_name": "Đức"},
  "base_version": 12,
  "target_version": null,
  "summary": "Đổi Dinh Bảo Đại III sang sáng ngày 2",
  "reason": "Chiều ngày 1 kín lịch, đi lại xa",
  "ops": [],
  "preview": {"changes": [], "cost_delta_per_person": 0},
  "warnings": [],
  "suggestion": {"id": "…", "author": "Phúc"},
  "status": "open",
  "close_reason": null,
  "votes": {"agree": 2, "disagree": 0, "required": 3, "majority": false, "total_members": 4, "pending": ["Toàn", "Khương"]},
  "votes_at_decision": null,
  "my_vote": "agree",
  "applied_version": null,
  "expires_at": null,
  "created_at": "…",
  "closed_at": null
}
```

`preview` là diff của `ops` trên `base_version`, cùng dạng với API diff. `votes.required` là ngưỡng tham khảo, `majority` = `agree ≥ required`; phiếu không tự áp dụng hay đóng đề xuất (ADR 0004). Phiếu công khai tên người bỏ (`voters` trong `GET /proposals/{id}`, OQ-17). `expires_at` null = không có hạn.

### `POST /trips/{trip_id}/proposals/draft` — nhờ Roa soạn (nhóm trưởng)

`{"request": "Đổi Dinh Bảo Đại III sang sáng ngày 2", "suggestion_id": null}` → `200 {"base_version": 12, "ops": [...], "summary", "reason", "preview", "warnings"}`.

Không ghi gì vào DB ngoài `agent_runs` (R-31). Nhóm trưởng xem, sửa `ops` nếu cần, rồi gửi bằng endpoint dưới.

### `POST /trips/{trip_id}/proposals` — tạo đề xuất (nhóm trưởng)

```json
{"kind": "edit", "base_version": 12, "ops": [...], "summary": "…", "reason": "…", "origin": "agent", "suggestion_id": null, "expires_at": null}
```

Khôi phục: `{"kind": "revert", "base_version": 13, "target_version": 9, "summary": "Quay lại v9", "reason": "…"}`.

- Kiểm `ops` trên `base_version` → 422 `invalid_ops` nếu lỗi.
- Chạy `check_plan` trên kết quả, lưu `warnings`.
- Ghi phiếu `agree` của nhóm trưởng. Không áp dụng ngay, kể cả khi nhóm chỉ có nhóm trưởng.
- `expires_at` tuỳ chọn, phải ở tương lai; bỏ trống = không có hạn (OQ-03).
- Có `suggestion_id` → góp ý chuyển `converted`.
- `201` đối tượng đề xuất.

### `GET /trips/{trip_id}/proposals?status=`

`status`: `open` (mặc định), `closed` (mọi trạng thái khác `open`), `all`. Mới nhất trước. Đề xuất mở có đặt hạn mà đã quá hạn được chuyển `reference` trước khi trả (`ARCHITECTURE.md` mục 6.4).

### `GET /proposals/{proposal_id}`

Đối tượng đề xuất + `"voters": [{"member": {"id", "display_name"}, "value": "agree", "updated_at"}]`.

### `PUT /proposals/{proposal_id}/vote`

`{"value": "agree"}` hoặc `{"value": "disagree"}`. Đổi ý được khi còn `open`; gửi lại cùng giá trị không đổi gì.

`200`:

```json
{"proposal": {"…": "đối tượng đề xuất sau khi bỏ phiếu"}}
```

Bỏ phiếu chỉ ghi nhận, không đổi trạng thái đề xuất. Đã đóng (kể cả vừa quá hạn) → 410 `proposal_closed`.

### `POST /proposals/{proposal_id}/apply` — áp dụng (nhóm trưởng)

Body rỗng. Áp dụng được dù chưa đạt đa số; frontend hỏi xác nhận trước khi gọi trong trường hợp đó.

- `200 {"proposal": {...status: "applied", votes_at_decision...}, "new_version": 13}`.
- Đụng mục đã đổi kể từ `base_version` → 409 `proposal_stale`, đề xuất chuyển `stale`.
- Đã đóng hoặc đã quá hạn → 410 `proposal_closed`.

### `POST /proposals/{proposal_id}/close` — đóng, để tham khảo (nhóm trưởng)

`{"note": "Chưa đủ người đồng ý, để sau"}` (tuỳ chọn). `200` đối tượng đề xuất với `status = reference`, `close_reason = leader_closed`, `votes_at_decision`. Đã đóng → 410.

### `POST /proposals/{proposal_id}/withdraw` — rút (nhóm trưởng)

`200` đối tượng đề xuất với `status = withdrawn`. Đã đóng → 410.

## 5. Góp ý

### `POST /trips/{trip_id}/suggestions` (thành viên)

```json
{"day": 2, "item_id": "itm_…", "category": "replace", "content": "Bữa trưa ngày 2 đổi sang quán chay vì Toàn ăn chay", "based_on_version": 13}
```

`category`: `add` / `remove` / `change_time` / `replace` / `other`. `201` góp ý.

### `GET /trips/{trip_id}/suggestions?status=`

Nhóm trưởng thấy tất cả; thành viên chỉ thấy của mình. `status` mặc định `new` với nhóm trưởng, `all` với thành viên.

```json
{"items": [{"id": "…", "author": {"id": "…", "display_name": "Phúc"}, "day": 2, "item_id": "itm_…", "item_name": "Cơm lam gà nướng", "category": "replace", "content": "…", "based_on_version": 13, "status": "new", "leader_note": null, "proposal": null, "created_at": "…"}]}
```

### `PATCH /suggestions/{suggestion_id}` (nhóm trưởng)

`{"status": "noted", "leader_note": "Để sau khi chốt khách sạn"}` hoặc `declined`. `converted` chỉ đặt qua `POST /proposals` với `suggestion_id`. Góp ý đã xử lý không đổi lại.

## 6. Hỏi Roa

### `POST /trips/{trip_id}/chat`

`{"message": "Ngày 2 tổng đi lại bao lâu?"}` → `200`:

```json
{
  "question": {"id": 101, "role": "member", "content": "…", "created_at": "…"},
  "answer": {"id": 102, "role": "agent", "content": "Khoảng 1 giờ 25 phút…", "plan_version": 13, "suggest_feedback": false, "created_at": "…"}
}
```

- Roa chạy chế độ `ask` trên phiên bản hiện tại, chỉ đọc (R-32).
- Câu hỏi mang ý sửa plan → `suggest_feedback: true`; frontend hiện nút "Gửi góp ý" điền sẵn nội dung.
- Chạy đồng bộ, timeout 30 giây. Streaming chưa làm ở MVP.

### `GET /trips/{trip_id}/chat?before=&limit=`

Tin cũ hơn `before` (id), `limit` mặc định 30, tối đa 100. Hội thoại chung cả nhóm (OQ-14): trả mọi tin của chuyến đi, kèm tên người hỏi.

## 7. Cập nhật

### `GET /trips/{trip_id}/updates?since=`

Frontend gọi mỗi 5 giây khi tab đang mở (OQ-10). `since` là `id` sự kiện cuối đã thấy (0 lần đầu).

```json
{
  "events": [
    {"id": 58, "type": "vote_cast", "payload": {"proposal_id": "…", "agree": 2, "disagree": 0}, "actor": "Phúc", "created_at": "…"},
    {"id": 59, "type": "version_created", "payload": {"version_no": 13, "proposal_number": 7}, "actor": "Đức", "created_at": "…"}
  ],
  "last_event_id": 59,
  "current_version": 13
}
```

Tối đa 100 sự kiện mỗi lần. Frontend dựa vào `type` để tải lại phần cần (plan, đề xuất, góp ý, chat). `store_ready` (`payload: {"city_slug", "place_count"}`) và `store_failed` (`payload: {"city_slug", "error"}`) báo đợt thu kho xong, khi đó gọi lại `GET /trips/{id}`. Kiểu sự kiện: `docs/DATABASE.md` mục 2.8. Sự kiện góp ý chỉ trả cho nhóm trưởng và người gửi.

## 8. Hệ thống

### `GET /health`

`200 {"status": "ok", "db": "ok", "version": "0.1.0"}`. Dùng cho health check của Render và để đánh thức backend trước buổi demo.

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Khương | Bản đầu: quy ước, lỗi, quyền, giới hạn; 21 endpoint cho chuyến đi, plan, đề xuất, góp ý, chat, cập nhật | ADR 0002 |
| 0.2 | 2026-11-27 | Khương | `generate` trả bản nháp hoặc `infeasible`; thêm `POST /plan` (duyệt v1), `POST /proposals/{id}/apply`, `/close`; bỏ phiếu không còn `outcome`; `expires_at` tuỳ chọn; chốt OQ-06, 14, 17 | ADR 0004, OQ-19 |
| 0.3 | 2026-11-28 | Khương | `POST /trips` bắt đầu đợt thu kho khi thành phố chưa có kho (`collecting_data`), trả `store`; thêm `GET /cities/{slug}/store`, `GET /cities/{slug}/places` (có `geo_category`), `POST /trips/{id}/store/retry` (hai endpoint `/cities` không cần token); `generate` trả 409 `data_collecting` / `store_failed`, plan item có cờ chưa xác minh; sự kiện `store_ready`, `store_failed`; `places_unavailable` đổi sang Geoapify | OQ-22, `docs/DATABASE.md` v0.3 |

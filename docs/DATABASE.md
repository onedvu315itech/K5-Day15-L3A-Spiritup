# DATABASE.md — Lược đồ dữ liệu Partaway

| | |
|---|---|
| Phiên bản | 0.2 |
| Trạng thái | Nháp |
| Người phụ trách | Khương (backend) |
| Người duyệt | Toàn (agent, cho mục 3), Phúc (frontend, cho mục 3) |
| Cập nhật | 2026-11-27 |
| Đi kèm | `ARCHITECTURE.md` mục 6, `docs/API_SPEC.md` |

PostgreSQL trên Supabase, truy cập qua SQLAlchemy 2 từ backend; migration bằng Alembic trong `backend/app/db/migrations/`, chỉ đi tiến. Tên bảng, cột tiếng Anh, `snake_case`. Thời gian là `timestamptz` (UTC). Tiền là số nguyên VND.

## 1. Tổng quan

```mermaid
erDiagram
  trips ||--o{ trip_members : "có"
  trips ||--o{ plan_versions : "có"
  trips ||--o{ proposals : "có"
  trips ||--o{ suggestions : "có"
  trips ||--o{ chat_messages : "có"
  trips ||--o{ trip_events : "có"
  proposals ||--o{ votes : "nhận"
  trip_members ||--o{ votes : "bỏ"
  suggestions |o--o| proposals : "chuyển thành"
  proposals |o--o| plan_versions : "tạo ra"
```

| Bảng | Service sở hữu | Việc |
|---|---|---|
| `trips` | `trip_service` | Chuyến đi, phiên bản hiện tại, link mời |
| `trip_members` | `trip_service` | Thành viên, vai trò, token |
| `plan_versions` | `plan_service` | Mọi phiên bản plan, bất biến |
| `proposals` | `proposal_service` | Đề xuất sửa hoặc khôi phục |
| `votes` | `proposal_service` | Phiếu |
| `suggestions` | `suggestion_service` | Góp ý của thành viên |
| `chat_messages` | `chat_service` | Hỏi đáp với Roa |
| `trip_events` | Service gây ra sự kiện | Dòng sự kiện cho polling và nhật ký hoạt động |
| `agent_runs` | `agent_service` | Mỗi lượt Roa: token, độ trễ, kết quả |
| `places_cache` | `agent_service` (công cụ) | Cache Google Places, Routes |
| `trending_spots` | Seed dữ liệu | Kho quán hot thu trước |

Service khác không query thẳng bảng không thuộc mình; gọi qua service sở hữu (R-12).

## 2. Bảng

### 2.1 `trips`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | |
| `title` | text | not null | "Đà Lạt 3N2Đ" |
| `destination` | text | not null | Thành phố |
| `start_date`, `end_date` | date | not null, `end_date >= start_date` | |
| `group_size` | int | not null, 2–20 | Số người dự kiến |
| `budget_per_person` | int | null | VND |
| `preferences` | jsonb | not null, mặc định `{}` | Sở thích, ràng buộc, phương tiện |
| `invite_code` | text | unique, not null | Chuỗi ngẫu nhiên ≥ 10 ký tự |
| `current_version` | int | not null, mặc định 0 | 0 = chưa có plan |
| `generation_status` | text | `idle` / `running` / `done` / `failed` | Trạng thái gọi `generate` (bản nháp v1); chặn gọi chồng |
| `created_at` | timestamptz | not null | |

### 2.2 `trip_members`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | |
| `trip_id` | uuid | FK `trips`, not null | |
| `display_name` | text | not null, unique theo `trip_id` | |
| `role` | text | `leader` / `member` | Mỗi trip đúng một `leader` (I3) |
| `token_hash` | text | unique, not null | SHA-256 của token; không lưu token gốc |
| `joined_at` | timestamptz | not null | |

Chỉ mục: unique một phần `(trip_id) WHERE role = 'leader'`.

### 2.3 `plan_versions`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | |
| `trip_id` | uuid | FK, not null | |
| `version_no` | int | not null, unique theo `trip_id` (I2) | 1, 2, 3… |
| `plan` | jsonb | not null | Đúng schema mục 3.1 |
| `source` | text | `generate` / `proposal` / `revert` | `generate` = bản nháp của Roa đã được nhóm trưởng duyệt thành v1 |
| `proposal_id` | uuid | FK `proposals`, null | Bắt buộc khi `source` ≠ `generate` (I6) |
| `created_by` | uuid | FK `trip_members` | Nhóm trưởng (cả v1: người duyệt) |
| `summary` | text | not null | Dòng hiện ở lịch sử phiên bản: "Áp dụng đề xuất #6 (3/4 đồng ý)" |
| `created_at` | timestamptz | not null | |

### 2.4 `proposals`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | |
| `trip_id` | uuid | FK, not null | |
| `number` | int | not null, unique theo `trip_id` | Số hiện cho người dùng: #7 |
| `kind` | text | `edit` / `revert` | |
| `origin` | text | `manual` / `agent` / `suggestion` | Nhóm trưởng tự sửa, nhờ Roa, hay từ góp ý |
| `author_id` | uuid | FK `trip_members` | Luôn là nhóm trưởng |
| `base_version` | int | not null | Phiên bản lúc tạo |
| `target_version` | int | null | Chỉ với `revert` |
| `ops` | jsonb | null | Danh sách thao tác mục 3.2; null với `revert` |
| `summary` | text | not null | "Đổi Dinh Bảo Đại III sang sáng ngày 2" |
| `reason` | text | null | |
| `warnings` | jsonb | not null, mặc định `[]` | Kết quả `check_plan`: quán đóng cửa, chồng giờ… |
| `suggestion_id` | uuid | FK `suggestions`, null | |
| `required_votes` | int | not null | Ngưỡng tham khảo `floor(n/2)+1`, chốt lúc tạo theo số thành viên khi đó. Chỉ để hiện "Đạt / Chưa đạt đa số" (ADR 0004) |
| `status` | text | `open` / `applied` / `reference` / `stale` / `withdrawn` | Mục 4.1 |
| `close_reason` | text | null | `leader_closed` / `expired` / `conflict` / `withdrawn` |
| `applied_version` | int | null | Phiên bản tạo ra khi `applied` |
| `votes_at_decision` | jsonb | null | Kết quả phiếu lúc nhóm trưởng áp dụng hoặc đóng: `{agree, disagree, pending, required, majority}` |
| `expires_at` | timestamptz | null | Chỉ có khi nhóm trưởng đặt hạn lúc tạo; null = không hết hạn (OQ-03) |
| `created_at`, `closed_at` | timestamptz | | |

### 2.5 `votes`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `proposal_id` | uuid | PK, FK | |
| `member_id` | uuid | PK, FK | Một phiếu một người một đề xuất (I4) |
| `value` | text | `agree` / `disagree` | |
| `created_at`, `updated_at` | timestamptz | | Đổi ý thì cập nhật `value`, `updated_at` |

### 2.6 `suggestions`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | PK | |
| `trip_id` | uuid | FK | |
| `author_id` | uuid | FK `trip_members` | |
| `day` | int | null | Ngày được góp ý |
| `item_id` | text | null | Mục trong plan được góp ý |
| `category` | text | `add` / `remove` / `change_time` / `replace` / `other` | |
| `content` | text | not null, ≤ 1000 ký tự | |
| `based_on_version` | int | not null | Phiên bản thành viên đang xem |
| `status` | text | `new` / `converted` / `noted` / `declined` | |
| `leader_note` | text | null | |
| `proposal_id` | uuid | FK, null | Khi `converted` |
| `created_at`, `handled_at` | timestamptz | | |

### 2.7 `chat_messages`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | bigint identity | PK | |
| `trip_id` | uuid | FK | |
| `member_id` | uuid | FK, null | Null với tin của Roa |
| `role` | text | `member` / `agent` | |
| `content` | text | not null | |
| `plan_version` | int | not null | Phiên bản Roa đã dùng để trả lời |
| `agent_run_id` | uuid | FK, null | |
| `created_at` | timestamptz | | |

Hội thoại là chung của cả nhóm (OQ-14): mọi thành viên đọc được mọi tin trong chuyến đi.

### 2.8 `trip_events`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint identity, PK | Con trỏ cho `GET /updates?since=` |
| `trip_id` | uuid FK | |
| `type` | text | `member_joined`, `version_created`, `proposal_created`, `vote_cast`, `proposal_applied`, `proposal_closed`, `suggestion_created`, `suggestion_handled`, `chat_message` |
| `actor_id` | uuid FK, null | |
| `payload` | jsonb | Dữ liệu tối thiểu để frontend biết cần tải lại gì |
| `created_at` | timestamptz | |

Ghi trong cùng transaction với thay đổi gây ra nó (I8).

### 2.9 `agent_runs`

`id` uuid · `trip_id` uuid null · `member_id` uuid null · `mode` (`generate` / `draft` / `ask`) · `model` text · `tokens_in`, `tokens_out`, `tool_calls`, `latency_ms` int · `status` (`ok` / `error` / `invalid_output` / `rate_limited`) · `error` text null · `created_at`. Token lấy từ `usage` của API, không ước lượng.

### 2.10 `places_cache`

`key` text PK (băm của loại gọi + tham số) · `kind` (`search` / `details` / `route`) · `response` jsonb · `fetched_at`, `expires_at` timestamptz. Hết hạn thì gọi lại và ghi đè (OQ-12).

### 2.11 `trending_spots`

`id` bigint PK · `city` text · `name` text · `category` text · `place_id` text null · `source` (`tiktok` / `instagram`) · `source_url` text · `engagement` jsonb (`views`, `likes`, `saves` nếu có) · `summary` text (nhóm tự tóm tắt, không chép nguyên văn) · `collected_at` date. Không lưu tên, ảnh, thông tin cá nhân của người đăng. Nguồn và cách thu: `data/DATA_CARD.md` (OQ-11).

## 3. Plan JSON và thao tác

Contract dùng chung giữa frontend, backend và Roa. Đổi cấu trúc là thay đổi loại L3 (`docs/CHANGE-MANAGEMENT.md`).

### 3.1 Plan

```json
{
  "schema_version": 1,
  "transport": "xe máy thuê",
  "notes": "",
  "days": [
    {
      "day": 2,
      "date": "2026-03-15",
      "title": "Ngoại ô và săn mây",
      "items": [
        {
          "id": "itm_7f3a2c",
          "start": "05:00",
          "end": "07:30",
          "kind": "sight",
          "name": "Đồi chè Cầu Đất",
          "place_id": "ChIJ…",
          "address": "…",
          "lat": 11.86,
          "lng": 108.55,
          "cost_per_person": 0,
          "reason": "Săn mây buổi sáng; đang hot trên TikTok",
          "note": "",
          "sources": [
            {"type": "google", "ref": "ChIJ…"},
            {"type": "tiktok", "ref": "trending_spots:42"}
          ]
        }
      ]
    }
  ]
}
```

- `kind`: `food` / `cafe` / `sight` / `hotel` / `activity` / `move` / `other`.
- `start`, `end`: `HH:MM` giờ địa phương; `end > start`; mục trong ngày xếp theo `start`.
- `id` do backend cấp (`itm_` + 6 ký tự ngẫu nhiên), duy nhất trong plan, không tái sử dụng sau khi xoá (I7).
- Tổng chi phí, quãng đường, số xung đột **không lưu** trong plan; backend tính khi đọc.

### 3.2 Thao tác (`ops`)

Áp dụng tuần tự; một thao tác lỗi thì cả đề xuất bị từ chối (422 `invalid_ops`).

| `op` | Trường | Mục bị đụng |
|---|---|---|
| `add_item` | `day`, `after_id` (null = đầu ngày), `item` (không có `id`) | `after_id` |
| `update_item` | `item_id`, `set` (các trường đổi) | `item_id` |
| `remove_item` | `item_id` | `item_id` |
| `move_item` | `item_id`, `to_day`, `after_id` | `item_id`, `after_id` |

```json
[
  {"op": "move_item", "item_id": "itm_dinh3", "to_day": 2, "after_id": "itm_7f3a2c"},
  {"op": "update_item", "item_id": "itm_dinh3", "set": {"start": "08:00", "end": "09:30"}}
]
```

"Mục bị đụng" dùng để phát hiện đề xuất cũ (`ARCHITECTURE.md` mục 6.3). Đề xuất `revert` coi như đụng mọi mục: phiên bản hiện tại khác `base_version` thì đề xuất thành `stale`.

## 4. Trạng thái và bất biến

### 4.1 Vòng đời đề xuất

```mermaid
stateDiagram-v2
  [*] --> open: nhóm trưởng gửi
  open --> applied: nhóm trưởng áp dụng, không đụng mục đã đổi
  open --> reference: nhóm trưởng đóng, hoặc quá hạn đã đặt
  open --> stale: phiên bản mới đụng cùng mục
  open --> withdrawn: nhóm trưởng rút
  applied --> [*]
  reference --> [*]
  stale --> [*]
  withdrawn --> [*]
```

Phiếu không tự chuyển trạng thái (ADR 0004). `reference`, `stale`, `withdrawn` vẫn hiện trong tab "Đề xuất" để tham khảo. Nhóm trưởng tạo đề xuất mới từ một đề xuất đã đóng (sao `ops`, cập nhật `base_version`) [NEEDS CLARIFICATION: OQ-04].

### 4.2 Bất biến

| Mã | Bất biến | Giữ bằng |
|---|---|---|
| I1 | Dòng `plan_versions` không bị `UPDATE`, `DELETE` | Service không có hàm sửa; review |
| I2 | `(trip_id, version_no)` duy nhất; `trips.current_version` = `version_no` lớn nhất | Unique index; cập nhật trong cùng transaction |
| I3 | Mỗi trip đúng một `leader` | Unique một phần |
| I4 | Một thành viên tối đa một phiếu cho một đề xuất | PK `votes` |
| I5 | Đề xuất đã đóng không đổi trạng thái, không nhận phiếu, không áp dụng lại | Kiểm trong service khi đã khoá dòng `trips` |
| I6 | `plan_versions.source` ≠ `generate` thì có `proposal_id`, và `proposals.applied_version` bằng `version_no` đó. `source = generate` chỉ có ở `version_no = 1` | Service; test |
| I7 | `id` mục duy nhất trong plan, không tái sử dụng | Backend cấp id; kiểm khi áp dụng |
| I8 | Mọi thay đổi trạng thái có dòng `trip_events` trong cùng transaction | Service; test |

## Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung | Căn cứ |
|---|---|---|---|---|
| 0.1 | 2026-11-27 | Khương | Bản đầu: 11 bảng, plan JSON, `ops`, vòng đời đề xuất, bất biến I1–I8 | ADR 0002 |
| 0.2 | 2026-11-27 | Khương | `expires_at` cho phép null; `close_reason` thay `not_enough_votes` bằng `leader_closed`; thêm `votes_at_decision`, sự kiện `proposal_applied`; v1 là bản nháp đã duyệt; hội thoại chung | ADR 0004, OQ-14 |

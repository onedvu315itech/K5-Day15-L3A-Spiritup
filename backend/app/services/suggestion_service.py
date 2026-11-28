"""Góp ý của thành viên gửi nhóm trưởng (docs/API_SPEC.md mục 5)."""
import uuid

from sqlalchemy import func, select

from app.db.base import utcnow
from app.db.models import PlanVersion, Proposal, Suggestion, Trip, TripEvent, TripMember
from app.errors import ApiError
from app.services import plan_service as ps


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def _find_item_name(db, trip_id: uuid.UUID, version_no: int, item_id: str | None) -> str | None:
    if not item_id:
        return None
    v = db.scalars(
        select(PlanVersion).where(PlanVersion.trip_id == trip_id, PlanVersion.version_no == version_no)
    ).first()
    if v is None:
        v = db.scalars(
            select(PlanVersion).where(PlanVersion.trip_id == trip_id).order_by(PlanVersion.version_no.desc())
        ).first()
    if v is None or not isinstance(v.plan, dict):
        return None
    for d in v.plan.get("days", []):
        for it in d.get("items", []):
            if it.get("id") == item_id:
                return it.get("name")
    return None


def suggestion_dict(db, s: Suggestion) -> dict:
    author = db.get(TripMember, s.author_id)
    prop = db.get(Proposal, s.proposal_id) if s.proposal_id else None
    return {
        "id": str(s.id),
        "author": {
            "id": str(author.id) if author else str(s.author_id),
            "display_name": author.display_name if author else "Thành viên",
        },
        "day": s.day,
        "item_id": s.item_id,
        "item_name": _find_item_name(db, s.trip_id, s.based_on_version, s.item_id),
        "category": s.category,
        "content": s.content,
        "based_on_version": s.based_on_version,
        "status": s.status,
        "leader_note": s.leader_note,
        "proposal": {"id": str(prop.id), "number": prop.number} if prop else None,
        "created_at": _iso(s.created_at),
    }


def create(db, trip: Trip, member: TripMember, body) -> dict:
    """POST /trips/{id}/suggestions: thành viên gửi góp ý gắn ngày/mục."""
    if trip.current_version == 0:
        raise ApiError(409, "version_conflict", "Chuyến đi chưa có lịch trình v1 để góp ý.")
    content = body.content.strip()
    if not content:
        raise ApiError(400, "bad_request", "Nội dung góp ý không được để trống.")
    if body.based_on_version < 1 or body.based_on_version > trip.current_version:
        raise ApiError(409, "version_conflict", f"Phiên bản v{body.based_on_version} không tồn tại.")
    now = utcnow()
    s = Suggestion(
        trip_id=trip.id,
        author_id=member.id,
        day=body.day,
        item_id=body.item_id or None,
        category=body.category,
        content=content,
        based_on_version=body.based_on_version,
        status="new",
        created_at=now,
    )
    db.add(s)
    db.flush()
    db.add(
        TripEvent(
            trip_id=trip.id,
            type="suggestion_created",
            actor_id=member.id,
            payload={"suggestion_id": str(s.id), "day": s.day, "category": s.category},
            created_at=now,
        )
    )
    db.commit()
    return suggestion_dict(db, s)


def list_for(db, trip: Trip, member: TripMember, status: str | None = None) -> list[dict]:
    """GET /trips/{id}/suggestions: nhóm trưởng thấy tất cả; thành viên chỉ thấy góp ý của mình."""
    effective_status = status or ("new" if member.role == "leader" else "all")
    q = select(Suggestion).where(Suggestion.trip_id == trip.id)
    if member.role != "leader":
        q = q.where(Suggestion.author_id == member.id)
    if effective_status != "all":
        q = q.where(Suggestion.status == effective_status)
    rows = db.scalars(q.order_by(Suggestion.created_at.desc()))
    return [suggestion_dict(db, s) for s in rows]


def load(db, member: TripMember, suggestion_id: uuid.UUID) -> Suggestion:
    s = db.get(Suggestion, suggestion_id)
    if s is None or s.trip_id != member.trip_id:
        raise ApiError(404, "not_found", "Không tìm thấy góp ý.")
    return s


def handle(db, member: TripMember, s: Suggestion, status: str, leader_note: str | None = None) -> dict:
    """PATCH /suggestions/{id}: nhóm trưởng ghi nhận (`noted`) hoặc từ chối (`declined`)."""
    ps.require_leader(member, "xử lý góp ý")
    if s.status != "new":
        raise ApiError(409, "already_handled", "Góp ý này đã được xử lý trước đó.")
    now = utcnow()
    s.status = status
    s.leader_note = (leader_note or "").strip() or None
    s.handled_at = now
    db.add(
        TripEvent(
            trip_id=s.trip_id,
            type="suggestion_handled",
            actor_id=member.id,
            payload={"suggestion_id": str(s.id), "status": status},
            created_at=now,
        )
    )
    db.commit()
    return suggestion_dict(db, s)


def new_count(db, trip_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Suggestion)
            .where(Suggestion.trip_id == trip_id, Suggestion.status == "new")
        )
        or 0
    )

"""Chuyến đi và thành viên: `trips`, `trip_members` (docs/DATABASE.md 2.1, 2.2). Quyền kiểm ở đây (R-20)."""
import hashlib
import secrets
import uuid

from app.db.base import utcnow
from app.db.models import CityStore, Trip, TripMember
from app.errors import ApiError
from app.services import place_service


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def trip_dict(t: Trip) -> dict:
    return {"id": str(t.id), "title": t.title, "destination": t.destination, "city_slug": t.city_slug,
            "start_date": t.start_date.isoformat(), "end_date": t.end_date.isoformat(), "group_size": t.group_size,
            "budget_per_person": t.budget_per_person, "preferences": t.preferences or {},
            "current_version": t.current_version, "generation_status": t.generation_status,
            "invite_code": t.invite_code}


def member_dict(m: TripMember) -> dict:
    return {"id": str(m.id), "display_name": m.display_name, "role": m.role}


def create_trip(db, body, geo, settings):
    """Người gọi thành nhóm trưởng. Trả (trip, member, token gốc, kho, việc nền của kho)."""
    store, job = place_service.ensure_store(db, body.destination, geo, settings)
    token = secrets.token_urlsafe(32)
    trip = Trip(title=body.title.strip(), destination=body.destination.strip(), city_slug=store.city_slug,
                start_date=body.start_date, end_date=body.end_date, group_size=body.group_size,
                budget_per_person=body.budget_per_person, preferences=body.preferences,
                invite_code=secrets.token_urlsafe(8), current_version=0,
                generation_status="collecting_data" if store.status == "collecting" else "idle", created_at=utcnow())
    db.add(trip)
    db.flush()
    member = TripMember(trip_id=trip.id, display_name=body.leader_name.strip(), role="leader",
                        token_hash=hash_token(token), joined_at=utcnow())
    db.add(member)
    db.commit()
    return trip, member, token, store, job


def authenticate(db, trip_id: uuid.UUID, authorization: str | None) -> TripMember:
    """Thiếu hoặc sai token → 401; token của chuyến đi khác → 404 (không lộ chuyến đi có tồn tại)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "unauthorized", "Thiếu token. Mở lại link mời để tham gia.")
    token = authorization[7:].strip()
    member = db.query(TripMember).filter(TripMember.token_hash == hash_token(token)).one_or_none()
    if member is None:
        raise ApiError(401, "unauthorized", "Token không hợp lệ.")
    if member.trip_id != trip_id:
        raise ApiError(404, "not_found", "Không tìm thấy.")
    return member


def retry_store(db, trip: Trip, member: TripMember, settings):
    """POST /trips/{id}/store/retry. Trả (HTTP status, kho, việc nền)."""
    if member.role != "leader":
        raise ApiError(403, "not_leader", "Chỉ nhóm trưởng được thu lại dữ liệu.")
    store = db.get(CityStore, trip.city_slug)
    if store.status == "ready":
        return 200, store, None
    if not place_service.claim_collection(db, store.city_slug, settings, utcnow()):
        db.rollback()
        raise ApiError(409, "data_collecting", "Roa đang thu dữ liệu địa điểm cho thành phố này.",
                       {"city_slug": store.city_slug})
    trip.generation_status = "collecting_data"
    db.commit()
    db.refresh(store)
    return 202, store, "collect"

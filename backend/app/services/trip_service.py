"""Chuyến đi và thành viên: `trips`, `trip_members` (docs/DATABASE.md 2.1, 2.2). Quyền kiểm ở đây (R-20)."""
import hashlib
import secrets
import uuid

from sqlalchemy.exc import IntegrityError

from app.db.base import utcnow
from app.db.models import CityStore, Trip, TripEvent, TripMember
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


def _trip_by_code(db, invite_code: str) -> Trip:
    trip = db.query(Trip).filter(Trip.invite_code == invite_code).one_or_none()
    if trip is None:
        raise ApiError(404, "not_found", "Link mời không đúng hoặc chuyến đi không còn.")
    return trip


def join_preview(db, invite_code: str) -> dict:
    """GET /join/{invite_code}: xem trước, không cần token."""
    trip = _trip_by_code(db, invite_code)
    count = db.query(TripMember).filter(TripMember.trip_id == trip.id).count()
    return {"trip": {"title": trip.title, "destination": trip.destination, "start_date": trip.start_date.isoformat(),
                     "end_date": trip.end_date.isoformat()}, "member_count": count}


def join(db, invite_code: str, display_name: str):
    """POST /join/{invite_code}: vào nhóm với vai `member` (nhóm trưởng gửi link). Trả (trip, member, token)."""
    trip = _trip_by_code(db, invite_code)
    name = display_name.strip()
    if not name:
        raise ApiError(400, "bad_request", "Tên hiển thị không được để trống.")
    if db.query(TripMember).filter(TripMember.trip_id == trip.id, TripMember.display_name == name).count():
        raise ApiError(409, "name_taken", f"Tên \"{name}\" đã có trong nhóm, chọn tên khác.")
    token = secrets.token_urlsafe(32)
    member = TripMember(trip_id=trip.id, display_name=name, role="member", token_hash=hash_token(token),
                        joined_at=utcnow())
    db.add(member)
    db.flush()
    db.add(TripEvent(trip_id=trip.id, type="member_joined", actor_id=member.id,
                     payload={"member_id": str(member.id), "display_name": name}))
    try:
        db.commit()
    except IntegrityError:  # hai người cùng tên vào cùng lúc
        db.rollback()
        raise ApiError(409, "name_taken", f"Tên \"{name}\" đã có trong nhóm, chọn tên khác.") from None
    return trip, member, token


def trip_detail(db, trip: Trip, member: TripMember) -> dict:
    """GET /trips/{id}."""
    from app.services import proposal_service, suggestion_service
    proposal_service.expire_due(db, trip.id)
    db.refresh(trip)
    members = db.query(TripMember).filter(TripMember.trip_id == trip.id).order_by(TripMember.joined_at).all()
    store = db.get(CityStore, trip.city_slug)
    return {"trip": trip_dict(trip), "store": place_service.store_dict(store),
            "members": [member_dict(m) for m in members], "me": {"id": str(member.id), "role": member.role},
            "counts": {
                "open_proposals": proposal_service.open_count(db, trip.id),
                "new_suggestions": suggestion_service.new_count(db, trip.id),
            }}


def updates(db, trip: Trip, since: int) -> dict:
    """GET /trips/{id}/updates?since=: tối đa 100 sự kiện sau `since`."""
    from app.services import proposal_service
    proposal_service.expire_due(db, trip.id)
    db.refresh(trip)
    rows = (db.query(TripEvent).filter(TripEvent.trip_id == trip.id, TripEvent.id > since)
            .order_by(TripEvent.id).limit(100).all())
    names = {m.id: m.display_name for m in db.query(TripMember).filter(TripMember.trip_id == trip.id)}
    events = [{"id": e.id, "type": e.type, "payload": e.payload or {}, "actor": names.get(e.actor_id),
               "created_at": e.created_at.isoformat().replace("+00:00", "Z")} for e in rows]
    return {"events": events, "last_event_id": events[-1]["id"] if events else since,
            "current_version": trip.current_version}


def member_by_token(db, authorization: str | None) -> TripMember:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "unauthorized", "Thiếu token. Mở lại link mời để tham gia.")
    member = db.query(TripMember).filter(TripMember.token_hash == hash_token(authorization[7:].strip())).one_or_none()
    if member is None:
        raise ApiError(401, "unauthorized", "Token không hợp lệ.")
    return member

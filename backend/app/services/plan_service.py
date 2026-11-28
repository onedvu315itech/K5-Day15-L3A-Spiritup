"""Bản nháp v1 (`generate`), duyệt v1, đọc plan và phiên bản (docs/API_SPEC.md mục 3).

Chỉ nhóm trưởng gọi `generate` và duyệt v1 (ADR 0002). Phiên bản bất biến: chỉ thêm dòng mới (I1).
"""
import logging
import os
import time
from datetime import timedelta

from sqlalchemy import select

from app import roa
from app.db.base import utcnow
from app.db.models import AgentRun, CityStore, PlanVersion, Proposal, Trip, TripEvent, TripMember
from app.errors import ApiError
from app.services import place_service
from app.services import plan_logic as pl

log = logging.getLogger("partaway.plan")


def require_leader(member: TripMember, what: str) -> None:
    if member.role != "leader":
        raise ApiError(403, "not_leader", f"Chỉ nhóm trưởng được {what}.")


def n_days(trip: Trip) -> int:
    return (trip.end_date - trip.start_date).days + 1


def _vnd(n: int) -> str:
    return f"{int(n):,}đ".replace(",", ".")


def request_text(trip: Trip, city_name: str, extra: str | None) -> str:
    """Yêu cầu chuyến đi → câu cho Roa (cùng dạng câu trong bộ câu thử)."""
    pref = trip.preferences or {}
    days = n_days(trip)
    parts = [f"Nhóm {trip.group_size} người đi {city_name} {days} ngày"
             + (f" {days - 1} đêm" if days > 1 else "") + f", từ {trip.start_date:%d/%m/%Y}."]
    if trip.budget_per_person:
        parts.append(f"Ngân sách {_vnd(trip.budget_per_person)}/người.")
    if pref.get("interests"):
        parts.append("Sở thích: " + ", ".join(map(str, pref["interests"])) + ".")
    if pref.get("constraints"):
        parts.append("Ràng buộc: " + "; ".join(map(str, pref["constraints"])) + ".")
    if pref.get("transport"):
        parts.append(f"Đi bằng {pref['transport']}.")
    # Giờ nhận/trả phòng: nhóm trưởng nêu thì Roa xếp theo; không nêu thì Roa dùng 14:00 / 12:00 hôm sau.
    if pref.get("checkin"):
        parts.append(f"Nhận phòng lúc {pref['checkin']}.")
    if pref.get("checkout"):
        parts.append(f"Trả phòng lúc {pref['checkout']}.")
    if extra and extra.strip():
        parts.append(extra.strip())
    return " ".join(parts)


def _event(db, trip, kind, actor, payload):
    db.add(TripEvent(trip_id=trip.id, type=kind, actor_id=actor.id if actor else None, payload=payload))


def generate(db, trip: Trip, member: TripMember, extra: str | None, run_agent=None) -> dict:
    """POST /trips/{id}/generate. Không ghi `plan_versions` (ADR 0004); ghi `agent_runs`, `generation_status`."""
    require_leader(member, "nhờ Roa soạn lịch trình")
    if trip.current_version > 0:
        raise ApiError(409, "plan_exists", "Chuyến đi đã có v1. Muốn đổi lịch thì tạo đề xuất.")
    store = db.get(CityStore, trip.city_slug)
    if store.status == "collecting":
        raise ApiError(409, "data_collecting", "Roa đang thu dữ liệu địa điểm cho thành phố này.",
                       {"city_slug": store.city_slug})
    if store.status == "failed":
        raise ApiError(409, "store_failed", "Đợt thu dữ liệu địa điểm bị lỗi. Thu lại rồi thử lại.",
                       {"error": store.error})
    if trip.generation_status == "running":
        raise ApiError(409, "generation_in_progress", "Roa đang soạn lịch trình cho chuyến đi này.")
    trip.generation_status = "running"
    db.commit()

    text = request_text(trip, store.city_name, extra)
    rows = place_service.rows_for_agent(db, store)
    t0 = time.monotonic()
    run = AgentRun(trip_id=trip.id, member_id=member.id, mode="generate", model=os.getenv("MODEL_NAME") or None,
                   status="ok", created_at=utcnow())
    try:
        res = (run_agent or roa.generate_plan)(text, rows)
    except Exception as e:  # noqa: BLE001 — lỗi model/công cụ: ghi lại, cho gọi lại
        log.exception("generate failed trip=%s", trip.id)
        run.status, run.error = "error", f"{type(e).__name__}"[:500]
        run.latency_ms = int((time.monotonic() - t0) * 1000)
        trip.generation_status = "failed"
        db.add(run)
        db.commit()
        raise ApiError(503, "llm_unavailable", "Roa chưa soạn được lịch trình lúc này, thử lại sau.") from None
    run.latency_ms = int((time.monotonic() - t0) * 1000)
    db.add(run)
    if res.get("status") == "ok" and res.get("plan"):
        plan = res["plan"]
        for d in plan["days"]:
            d["date"] = (trip.start_date + timedelta(days=d["day"] - 1)).isoformat()
        trip.generation_status = "done"
        db.commit()
        raw_computed = res.get("computed") or {}
        warnings = [
            {"item_id": None, "type": "warning", "message": w} if isinstance(w, str) else w
            for w in (raw_computed.get("warnings") or [])
        ]
        computed = {**raw_computed, "warnings": warnings}
        return {"status": "ok", "draft": {"plan": plan, "computed": computed,
                                          "warnings": warnings, "lodging": res.get("lodging"),
                                          "message": res.get("output")},
                "agent_run_id": str(run.id)}
    trip.generation_status = "done"
    db.commit()
    # Không xếp được hoặc thiếu thông tin: Roa nói rõ vì sao, không trả plan sai ràng buộc.
    return {"status": "infeasible", "draft": None, "reasons": [res.get("output") or ""],
            "agent_status": res.get("status"), "agent_run_id": str(run.id)}


def version_dict(db, trip: Trip, v: PlanVersion, with_plan: bool = True) -> dict:
    author = db.get(TripMember, v.created_by)
    prop = db.get(Proposal, v.proposal_id) if v.proposal_id else None
    out = {"version_no": v.version_no, "is_current": v.version_no == trip.current_version, "source": v.source,
           "summary": v.summary, "created_by": {"id": str(author.id), "display_name": author.display_name},
           "proposal": {"id": str(prop.id), "number": prop.number} if prop else None,
           "created_at": v.created_at.isoformat().replace("+00:00", "Z")}
    if with_plan:
        out["plan"] = v.plan
        out["computed"] = pl.compute(v.plan)
    return out


def get_version(db, trip: Trip, version_no: int | None = None) -> PlanVersion:
    if trip.current_version == 0:
        raise ApiError(404, "not_found", "Chuyến đi chưa có lịch trình.")
    n = trip.current_version if version_no is None else version_no
    v = db.scalars(select(PlanVersion).where(PlanVersion.trip_id == trip.id, PlanVersion.version_no == n)).first()
    if v is None:
        raise ApiError(404, "not_found", f"Không có phiên bản v{n}.")
    return v


def approve(db, trip: Trip, member: TripMember, plan: dict) -> dict:
    """POST /trips/{id}/plan: nhóm trưởng duyệt bản nháp thành v1 (không qua bỏ phiếu)."""
    require_leader(member, "duyệt lịch trình")
    locked = db.scalars(select(Trip).where(Trip.id == trip.id).with_for_update()).one()
    if locked.current_version > 0:
        raise ApiError(409, "plan_exists", "Chuyến đi đã có v1.")
    try:
        clean = pl.normalize(plan, trip.start_date, n_days(trip))
    except pl.PlanError as e:
        raise ApiError(422, "invalid_plan", e.message) from None
    v = PlanVersion(trip_id=trip.id, version_no=1, plan=clean, source="generate", created_by=member.id,
                    summary="Duyệt lịch trình ban đầu do Roa soạn", created_at=utcnow())
    db.add(v)
    locked.current_version = 1
    _event(db, trip, "version_created", member, {"version_no": 1, "proposal_number": None})
    db.commit()
    return version_dict(db, locked, v)


def list_versions(db, trip: Trip) -> list[dict]:
    rows = db.scalars(select(PlanVersion).where(PlanVersion.trip_id == trip.id)
                      .order_by(PlanVersion.version_no.desc()))
    return [version_dict(db, trip, v, with_plan=False) for v in rows]


def version_diff(db, trip: Trip, n: int, against: int | None) -> dict:
    new = get_version(db, trip, n)
    old = get_version(db, trip, against if against is not None else n - 1)
    return {"from": old.version_no, "to": new.version_no, **pl.diff(old.plan, new.plan)}

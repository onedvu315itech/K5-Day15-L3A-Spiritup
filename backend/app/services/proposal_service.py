"""Đề xuất và bỏ phiếu (docs/API_SPEC.md mục 4; CR-001 chờ duyệt).

- Mọi thành viên tạo thẻ đề xuất; người tạo tự tính là đồng ý.
- Phiếu chỉ ghi nhận ý kiến, ngưỡng tham khảo `floor(n/2)+1` (ADR 0004). Chỉ nhóm trưởng áp dụng hoặc đóng.
- Thẻ mở trong `settings.proposal_ttl_hours` (48 giờ) rồi thành `reference` (close_reason `expired`), tính lười
  khi đọc (ARCHITECTURE.md mục 6.4): vẫn xem được, không bỏ phiếu hay áp dụng được nữa.
"""
from datetime import timedelta

from sqlalchemy import func, select

from app import roa
from app.db.base import utcnow
from app.db.models import AgentRun, CityStore, PlanVersion, Proposal, Suggestion, Trip, TripEvent, TripMember, Vote
from app.errors import ApiError
from app.services import place_service
from app.services import plan_logic as pl
from app.services import plan_service as ps


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def _event(db, trip_id, kind, actor_id, payload):
    db.add(TripEvent(trip_id=trip_id, type=kind, actor_id=actor_id, payload=payload))


def _members(db, trip_id) -> list[TripMember]:
    return list(db.scalars(select(TripMember).where(TripMember.trip_id == trip_id).order_by(TripMember.joined_at)))


def tally(db, p: Proposal) -> dict:
    members = _members(db, p.trip_id)
    votes = {v.member_id: v.value for v in db.scalars(select(Vote).where(Vote.proposal_id == p.id))}
    agree = sum(1 for v in votes.values() if v == "agree")
    return {"agree": agree, "disagree": sum(1 for v in votes.values() if v == "disagree"),
            "required": p.required_votes, "majority": agree >= p.required_votes, "total_members": len(members),
            "pending": [m.display_name for m in members if m.id not in votes]}


def proposal_dict(db, p: Proposal, me: TripMember | None = None, voters: bool = False) -> dict:
    author = db.get(TripMember, p.author_id)
    sug_info = None
    if p.suggestion_id:
        sug = db.get(Suggestion, p.suggestion_id)
        if sug:
            sug_author = db.get(TripMember, sug.author_id)
            sug_info = {"id": str(sug.id), "author": sug_author.display_name if sug_author else "Thành viên"}
    out = {"id": str(p.id), "number": p.number, "kind": p.kind, "origin": p.origin,
           "author": {"id": str(author.id), "display_name": author.display_name},
           "base_version": p.base_version, "target_version": p.target_version, "summary": p.summary,
           "reason": p.reason, "ops": p.ops, "preview": _preview(db, p), "warnings": p.warnings or [],
           "suggestion": sug_info, "status": p.status, "close_reason": p.close_reason, "votes": tally(db, p),
           "votes_at_decision": p.votes_at_decision, "my_vote": None, "applied_version": p.applied_version,
           "expires_at": _iso(p.expires_at), "created_at": _iso(p.created_at), "closed_at": _iso(p.closed_at)}
    if me is not None:
        v = db.get(Vote, (p.id, me.id))
        out["my_vote"] = v.value if v else None
    if voters:
        rows = db.scalars(select(Vote).where(Vote.proposal_id == p.id).order_by(Vote.updated_at))
        out["voters"] = [{"member": {"id": str(v.member_id), "display_name": db.get(TripMember, v.member_id).display_name},
                          "value": v.value, "updated_at": _iso(v.updated_at)} for v in rows]
    return out


def _plan_of(db, trip_id, n) -> dict | None:
    v = db.scalars(select(PlanVersion).where(PlanVersion.trip_id == trip_id, PlanVersion.version_no == n)).first()
    return v.plan if v else None


def _preview(db, p: Proposal) -> dict:
    base = _plan_of(db, p.trip_id, p.base_version)
    if base is None:
        return {"changes": [], "cost_delta_per_person": 0}
    if p.kind == "revert":
        target = _plan_of(db, p.trip_id, p.target_version)
        return pl.diff(base, target) if target else {"changes": [], "cost_delta_per_person": 0}
    try:
        return pl.diff(base, pl.apply_ops(base, p.ops, 10_000))
    except pl.PlanError:
        return {"changes": [], "cost_delta_per_person": 0}


def _close(db, p: Proposal, status: str, reason: str, actor_id=None) -> None:
    p.votes_at_decision = {k: v for k, v in tally(db, p).items() if k != "total_members"}
    p.status, p.close_reason, p.closed_at = status, reason, utcnow()
    _event(db, p.trip_id, "proposal_closed", actor_id,
           {"proposal_id": str(p.id), "number": p.number, "status": status, "close_reason": reason})


def expire_due(db, trip_id) -> None:
    """Đề xuất mở đã quá `expires_at` → `reference` (expired), cùng transaction với sự kiện (I8)."""
    now = utcnow()
    due = list(db.scalars(select(Proposal).where(Proposal.trip_id == trip_id, Proposal.status == "open",
                                                 Proposal.expires_at.is_not(None), Proposal.expires_at <= now)))
    for p in due:
        _close(db, p, "reference", "expired")
    if due:
        db.commit()


def _open_or_410(db, p: Proposal) -> None:
    expire_due(db, p.trip_id)
    db.refresh(p)
    if p.status != "open":
        raise ApiError(410, "proposal_closed", "Đề xuất đã đóng, chỉ còn để tham khảo.",
                       {"status": p.status, "close_reason": p.close_reason})


def create(db, trip: Trip, member: TripMember, body, settings) -> dict:
    """POST /trips/{id}/proposals. Mọi thành viên (CR-001). Không áp dụng ngay."""
    if trip.current_version == 0:
        raise ApiError(409, "version_conflict", "Chuyến đi chưa có v1 để đề xuất sửa.")
    if body.base_version < 1 or body.base_version > trip.current_version:
        raise ApiError(409, "version_conflict", f"Phiên bản v{body.base_version} không tồn tại.",
                       {"current_version": trip.current_version})
    base = _plan_of(db, trip.id, body.base_version)
    if body.kind == "revert":
        target = body.target_version
        if target is None or target < 1 or target > trip.current_version or target == body.base_version:
            raise ApiError(422, "invalid_ops", "Phiên bản khôi phục không hợp lệ.")
        result, ops = _plan_of(db, trip.id, target), None
    else:
        try:
            result = pl.apply_ops(base, body.ops or [], ps.n_days(trip))
        except pl.PlanError as e:
            raise ApiError(422, "invalid_ops", e.message, {"index": e.index}) from None
        ops = body.ops
    sug = None
    sug_id = getattr(body, "suggestion_id", None)
    if sug_id is not None:
        sug = db.get(Suggestion, sug_id)
        if sug is None or sug.trip_id != trip.id:
            raise ApiError(404, "not_found", "Không tìm thấy góp ý.")
        if sug.status != "new":
            raise ApiError(409, "already_handled", "Góp ý này đã được xử lý trước đó.")
    n_members = len(_members(db, trip.id))
    number = (db.scalar(select(func.max(Proposal.number)).where(Proposal.trip_id == trip.id)) or 0) + 1
    now = utcnow()
    p = Proposal(trip_id=trip.id, number=number, kind=body.kind, origin=body.origin, author_id=member.id,
                 base_version=body.base_version, target_version=body.target_version if body.kind == "revert" else None,
                 ops=ops, summary=body.summary.strip(), reason=(body.reason or "").strip() or None,
                 warnings=pl.compute(result)["warnings"], suggestion_id=sug.id if sug else None,
                 required_votes=n_members // 2 + 1, status="open",
                 expires_at=now + timedelta(hours=settings.proposal_ttl_hours), created_at=now)
    db.add(p)
    db.flush()
    if sug is not None:
        sug.status = "converted"
        sug.proposal_id = p.id
        sug.handled_at = now
        _event(db, trip.id, "suggestion_handled", member.id,
               {"suggestion_id": str(sug.id), "status": "converted", "proposal_id": str(p.id)})
    db.add(Vote(proposal_id=p.id, member_id=member.id, value="agree", created_at=now, updated_at=now))
    _event(db, trip.id, "proposal_created", member.id, {"proposal_id": str(p.id), "number": number})
    db.commit()
    return proposal_dict(db, p, member)


def list_for(db, trip: Trip, member: TripMember, status: str) -> list[dict]:
    expire_due(db, trip.id)
    q = select(Proposal).where(Proposal.trip_id == trip.id)
    if status == "open":
        q = q.where(Proposal.status == "open")
    elif status == "closed":
        q = q.where(Proposal.status != "open")
    return [proposal_dict(db, p, member) for p in db.scalars(q.order_by(Proposal.number.desc()))]


def load(db, member: TripMember, proposal_id) -> Proposal:
    p = db.get(Proposal, proposal_id)
    if p is None or p.trip_id != member.trip_id:
        raise ApiError(404, "not_found", "Không tìm thấy đề xuất.")
    return p


def get(db, member: TripMember, p: Proposal) -> dict:
    expire_due(db, p.trip_id)
    db.refresh(p)
    return proposal_dict(db, p, member, voters=True)


def vote(db, member: TripMember, p: Proposal, value: str) -> dict:
    _open_or_410(db, p)
    now = utcnow()
    v = db.get(Vote, (p.id, member.id))
    if v is None:
        db.add(Vote(proposal_id=p.id, member_id=member.id, value=value, created_at=now, updated_at=now))
    elif v.value != value:
        v.value, v.updated_at = value, now
    else:
        return proposal_dict(db, p, member)  # gửi lại cùng giá trị: không đổi gì
    db.flush()
    t = tally(db, p)
    _event(db, p.trip_id, "vote_cast", member.id,
           {"proposal_id": str(p.id), "agree": t["agree"], "disagree": t["disagree"]})
    db.commit()
    return proposal_dict(db, p, member)


def _used_ids(db, trip_id) -> set:
    return {i for v in db.scalars(select(PlanVersion).where(PlanVersion.trip_id == trip_id)) for i in pl.all_ids(v.plan)}


def apply(db, member: TripMember, p: Proposal) -> dict:
    """POST /proposals/{id}/apply: nhóm trưởng; áp dụng được dù chưa đạt đa số (ADR 0004)."""
    ps.require_leader(member, "áp dụng đề xuất")
    trip = db.scalars(select(Trip).where(Trip.id == p.trip_id).with_for_update()).one()
    _open_or_410(db, p)
    current = _plan_of(db, trip.id, trip.current_version)
    base = _plan_of(db, trip.id, p.base_version)
    if p.kind == "revert":
        conflict = p.base_version != trip.current_version  # khôi phục coi như đụng mọi mục
        new_plan = _plan_of(db, trip.id, p.target_version)
    else:
        conflict = p.base_version != trip.current_version and bool(pl.touched(p.ops) & pl.changed_ids(base, current))
        new_plan = None
        if not conflict:
            try:
                new_plan = pl.apply_ops(current, p.ops, ps.n_days(trip), _used_ids(db, trip.id))
            except pl.PlanError:
                conflict = True
    if conflict:
        _close(db, p, "stale", "conflict", member.id)
        db.commit()
        raise ApiError(409, "proposal_stale",
                       f"Đề xuất dựa trên v{p.base_version}, đã có thay đổi đụng cùng mục ở v{trip.current_version}.",
                       {"current_version": trip.current_version})
    t = tally(db, p)
    no = trip.current_version + 1
    summary = (f"Khôi phục v{p.target_version} theo đề xuất #{p.number}" if p.kind == "revert" else
               f"Áp dụng đề xuất #{p.number} ({t['agree']}/{t['total_members']} đồng ý)")
    db.add(PlanVersion(trip_id=trip.id, version_no=no, plan=new_plan, proposal_id=p.id, created_by=member.id,
                       source="revert" if p.kind == "revert" else "proposal", summary=summary, created_at=utcnow()))
    trip.current_version = no
    p.votes_at_decision = {k: v for k, v in t.items() if k != "total_members"}
    p.status, p.applied_version, p.closed_at = "applied", no, utcnow()
    _event(db, trip.id, "proposal_applied", member.id, {"proposal_id": str(p.id), "number": p.number, "version_no": no})
    _event(db, trip.id, "version_created", member.id, {"version_no": no, "proposal_number": p.number})
    # Đề xuất mở khác đụng mục vừa đổi → stale ngay (ARCHITECTURE.md mục 6.3 bước 3).
    changed = pl.changed_ids(current, new_plan)
    for other in db.scalars(select(Proposal).where(Proposal.trip_id == trip.id, Proposal.status == "open",
                                                   Proposal.id != p.id)):
        if other.kind == "revert" or pl.touched(other.ops) & changed:
            _close(db, other, "stale", "conflict", member.id)
    db.commit()
    return {"proposal": proposal_dict(db, p, member), "new_version": no}


def close(db, member: TripMember, p: Proposal) -> dict:
    ps.require_leader(member, "đóng đề xuất")
    _open_or_410(db, p)
    _close(db, p, "reference", "leader_closed", member.id)
    db.commit()
    return proposal_dict(db, p, member)


def withdraw(db, member: TripMember, p: Proposal) -> dict:
    """Người tạo hoặc nhóm trưởng rút đề xuất."""
    if member.id != p.author_id and member.role != "leader":
        raise ApiError(403, "not_author", "Chỉ người tạo đề xuất hoặc nhóm trưởng được rút.")
    _open_or_410(db, p)
    _close(db, p, "withdrawn", "withdrawn", member.id)
    db.commit()
    return proposal_dict(db, p, member)


def open_count(db, trip_id) -> int:
    return db.scalar(select(func.count()).select_from(Proposal)
                     .where(Proposal.trip_id == trip_id, Proposal.status == "open")) or 0


def _build_draft_payload(db, trip: Trip, member: TripMember, request_text: str,
                         history: list[dict] | None = None, draft_fn=None) -> tuple[AgentRun, dict | None, str]:
    base = _plan_of(db, trip.id, trip.current_version)
    store = db.get(CityStore, trip.city_slug)
    rows = place_service.rows_for_agent(db, store) if store is not None else []
    trip_meta = {
        "title": trip.title,
        "destination": trip.destination,
        "group_size": trip.group_size,
        "budget_per_person": trip.budget_per_person,
        "current_version": trip.current_version,
    }
    import time
    t0 = time.monotonic()
    run = AgentRun(trip_id=trip.id, member_id=member.id, mode="draft", status="ok", created_at=utcnow())
    try:
        res = (draft_fn or roa.draft_edit)(request_text, base, rows, history or [], trip_meta)
    except Exception as e:  # noqa: BLE001
        run.status = "error"
        run.error = type(e).__name__[:500]
        run.latency_ms = int((time.monotonic() - t0) * 1000)
        db.add(run)
        db.commit()
        raise ApiError(503, "llm_unavailable", "Roa chưa soạn được thay đổi lúc này, thử lại sau.") from None

    run.latency_ms = int((time.monotonic() - t0) * 1000)
    run.model = res.get("model")
    run.tokens_in = res.get("tokens_in")
    run.tokens_out = res.get("tokens_out")
    run.tool_calls = 0

    ops = res.get("ops") or []
    answer_txt = (res.get("answer") or "").strip()
    if not res.get("can_edit") or not ops:
        db.add(run)
        db.flush()
        return run, None, answer_txt

    try:
        result = pl.apply_ops(base, ops, ps.n_days(trip))
    except pl.PlanError as e:
        run.status = "invalid_output"
        run.error = e.message[:500]
        db.add(run)
        db.flush()
        return run, None, answer_txt or e.message

    db.add(run)
    db.flush()
    payload = {
        "base_version": trip.current_version,
        "ops": ops,
        "summary": (res.get("summary") or request_text).strip()[:300],
        "reason": (res.get("reason") or "").strip(),
        "preview": pl.diff(base, result),
        "warnings": pl.compute(result)["warnings"],
    }
    return run, payload, answer_txt


def draft_for_chat(db, trip: Trip, member: TripMember, request_text: str,
                   history: list[dict] | None = None, draft_fn=None) -> dict | None:
    """Soạn bản nháp ops từ khung chat; trả dict kèm `answer` & `run_id`, hoặc None để fallback sang ask."""
    if trip.current_version == 0:
        return None
    run, payload, answer_txt = _build_draft_payload(db, trip, member, request_text, history, draft_fn=draft_fn)
    if payload is None:
        return None
    return {
        **payload,
        "answer": answer_txt or f"Mình đã soạn sẵn phương án: {payload['summary']}. Bạn bấm áp dụng bên dưới nếu đồng ý nhé.",
        "run_id": run.id,
    }


def draft(db, trip: Trip, member: TripMember, request_text: str, draft_fn=None) -> dict:
    """POST /trips/{id}/proposals/draft: nhờ Roa soạn `ops` dựa trên kho địa điểm thật (R-31)."""
    if trip.current_version == 0:
        raise ApiError(409, "version_conflict", "Chuyến đi chưa có v1 để nhờ Roa soạn sửa.")
    _, payload, answer_txt = _build_draft_payload(db, trip, member, request_text, draft_fn=draft_fn)
    if payload is None:
        db.commit()
        raise ApiError(422, "invalid_ops", answer_txt or "Roa chưa tìm được thay đổi hợp lệ trong kho địa điểm.")
    db.commit()
    return payload

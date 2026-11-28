"""Hỏi đáp chung với Roa (`chat_messages`, `agent_runs`) kèm bộ nhớ hội thoại trượt (docs/API_SPEC.md mục 6)."""
from collections import defaultdict, deque
import logging
import time
import uuid

from sqlalchemy import select

from app import roa
from app.db.base import utcnow
from app.db.models import AgentRun, ChatMessage, Trip, TripEvent, TripMember
from app.errors import ApiError
from app.services import plan_service

log = logging.getLogger("partaway.chat")

MEMORY_WINDOW = 10          # Số tin nhắn gần nhất truyền vào context của Roa
RATE_PER_MINUTE = 6         # API_SPEC 1.5: 6 câu/phút/thành viên
RATE_PER_DAY = 60           # API_SPEC 1.5: 60 câu/ngày/thành viên
_RATE_LOG: dict[uuid.UUID, deque[float]] = defaultdict(deque)


def reset_rate_limits() -> None:
    """Xoá bộ đếm tần suất trong bộ nhớ (dùng cho test)."""
    _RATE_LOG.clear()


def _check_rate_limit(member_id: uuid.UUID) -> None:
    now = time.monotonic()
    q = _RATE_LOG[member_id]
    while q and now - q[0] >= 86400:
        q.popleft()
    if len(q) >= RATE_PER_DAY:
        raise ApiError(429, "rate_limited", "Bạn đã dùng hết 60 câu hỏi hôm nay, hãy thử lại vào ngày mai.")
    recent_minute = sum(1 for ts in q if now - ts < 60)
    if recent_minute >= RATE_PER_MINUTE:
        raise ApiError(429, "rate_limited", "Bạn hỏi quá nhanh (tối đa 6 câu/phút), vui lòng đợi ít giây.")
    q.append(now)


def _msg_dict(row: ChatMessage, names: dict[uuid.UUID, str], suggest_feedback: bool | None = None) -> dict:
    out = {
        "id": row.id,
        "role": row.role,
        "content": row.content,
        "created_at": row.created_at.isoformat().replace("+00:00", "Z"),
    }
    if row.role == "member":
        out["author_name"] = names.get(row.member_id) or "Thành viên"
    else:
        out["plan_version"] = row.plan_version
        if suggest_feedback is not None:
            out["suggest_feedback"] = suggest_feedback
    return out


def list_messages(db, trip: Trip, before: int | None = None, limit: int = 30) -> list[dict]:
    """GET /trips/{id}/chat: hội thoại chung cả nhóm (OQ-14), trả theo thứ tự thời gian tăng dần."""
    limit = max(1, min(100, limit))
    stmt = select(ChatMessage).where(ChatMessage.trip_id == trip.id)
    if before is not None:
        stmt = stmt.where(ChatMessage.id < before)
    rows = list(db.scalars(stmt.order_by(ChatMessage.id.desc()).limit(limit)))
    rows.reverse()
    names = {
        m.id: m.display_name
        for m in db.scalars(select(TripMember).where(TripMember.trip_id == trip.id))
    }
    return [_msg_dict(r, names) for r in rows]


def send_message(db, trip: Trip, member: TripMember, message: str, ask_fn=None) -> dict:
    """POST /trips/{id}/chat: lưu câu hỏi + trả lời Roa kèm `MEMORY_WINDOW` tin nhắn làm memory."""
    text = message.strip()
    if not text:
        raise ApiError(400, "bad_request", "Nội dung câu hỏi không được để trống.")
    _check_rate_limit(member.id)

    plan_dict = None
    plan_version = trip.current_version
    if trip.current_version > 0:
        plan_dict = plan_service.get_version(db, trip).plan

    names = {
        m.id: m.display_name
        for m in db.scalars(select(TripMember).where(TripMember.trip_id == trip.id))
    }
    recent_rows = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.trip_id == trip.id)
            .order_by(ChatMessage.id.desc())
            .limit(MEMORY_WINDOW)
        )
    )
    recent_rows.reverse()
    history = [
        {
            "role": r.role,
            "author_name": names.get(r.member_id, "Thành viên") if r.role == "member" else "Roa",
            "content": r.content,
        }
        for r in recent_rows
    ]
    trip_meta = {
        "title": trip.title,
        "destination": trip.destination,
        "group_size": trip.group_size,
        "budget_per_person": trip.budget_per_person,
        "current_version": trip.current_version,
    }

    t0 = time.monotonic()
    run = AgentRun(trip_id=trip.id, member_id=member.id, mode="ask", status="ok", created_at=utcnow())
    try:
        res = (ask_fn or roa.ask_plan)(text, plan_dict, history, trip_meta)
    except Exception as e:  # noqa: BLE001 — ghi nhận lỗi LLM, không làm sập API
        log.exception("ask failed trip=%s", trip.id)
        run.status = "error"
        run.error = type(e).__name__[:500]
        run.latency_ms = int((time.monotonic() - t0) * 1000)
        db.add(run)
        db.commit()
        raise ApiError(503, "llm_unavailable", "Roa chưa trả lời được lúc này, thử lại sau.") from None

    run.latency_ms = int((time.monotonic() - t0) * 1000)
    run.model = res.get("model")
    run.tokens_in = res.get("tokens_in")
    run.tokens_out = res.get("tokens_out")
    run.tool_calls = 0
    db.add(run)
    db.flush()

    now = utcnow()
    question_row = ChatMessage(
        trip_id=trip.id,
        member_id=member.id,
        role="member",
        content=text,
        plan_version=plan_version,
        created_at=now,
    )
    answer_text = (res.get("answer") or "").strip() or "Mình chưa có thông tin để trả lời câu hỏi này."
    answer_row = ChatMessage(
        trip_id=trip.id,
        member_id=None,
        role="agent",
        content=answer_text,
        plan_version=plan_version,
        agent_run_id=run.id,
        created_at=utcnow(),
    )
    db.add_all([question_row, answer_row])
    db.flush()
    db.add(
        TripEvent(
            trip_id=trip.id,
            type="chat_message",
            actor_id=member.id,
            payload={"message_id": answer_row.id, "plan_version": plan_version},
            created_at=now,
        )
    )
    db.commit()

    return {
        "question": _msg_dict(question_row, names),
        "answer": _msg_dict(answer_row, names, suggest_feedback=bool(res.get("suggest_feedback"))),
    }

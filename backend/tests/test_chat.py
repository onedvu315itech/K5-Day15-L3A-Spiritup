"""Test endpoint /api/v1/trips/{id}/chat: lưu lịch sử DB, truyền sliding-window memory và rate limit."""
import pytest

from app.services import chat_service
from tests.test_api import TRIP, call, server  # noqa: F401
from tests.test_group_flow import ready_trip


@pytest.fixture(autouse=True)
def clean_rate_limits():
    chat_service.reset_rate_limits()
    yield
    chat_service.reset_rate_limits()


def test_chat_memory_and_rate_limit(server, monkeypatch):
    tid, leader, code = ready_trip(server)
    T = f"/api/v1/trips/{tid}"

    # Tạo v1 với model giả
    import agent  # đã có trong sys.path qua backend/app/roa.py khi import app
    monkeypatch.setattr(
        agent,
        "call_model",
        lambda system, user: {"text": "", "model": "fake", "tokens_in": 0, "tokens_out": 0},
    )
    st, gen = call(server, "POST", f"{T}/generate", {}, leader)
    assert st == 200 and gen["status"] == "ok"
    st, _ = call(server, "POST", f"{T}/plan", {"plan": gen["draft"]["plan"]}, leader)
    assert st == 201

    st, j = call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Phúc"})
    assert st == 201
    phuc = j["token"]

    seen_histories = []

    def fake_ask_about_plan(question, plan=None, history=None, trip_meta=None):
        seen_histories.append(list(history or []))
        wants_edit = "đổi" in question.lower()
        return {
            "answer": f"Đã nhận '{question}' (nhớ {len(history or [])} tin trước).",
            "suggest_feedback": wants_edit,
            "model": "fake-ask",
            "tokens_in": 10,
            "tokens_out": 8,
        }

    monkeypatch.setattr(agent, "ask_about_plan", fake_ask_about_plan)

    # Lượt 1: memory rỗng
    st, r1 = call(server, "POST", f"{T}/chat", {"message": "Ngày 1 ăn gì?"}, phuc)
    assert st == 200
    assert r1["question"]["author_name"] == "Phúc"
    assert r1["answer"]["plan_version"] == 1
    assert r1["answer"]["suggest_feedback"] is False
    assert seen_histories[0] == []

    # Lượt 2: Roa nhận được cả câu hỏi và câu trả lời của lượt 1 từ DB
    st, r2 = call(server, "POST", f"{T}/chat", {"message": "Đổi quán đó được không?"}, leader)
    assert st == 200
    assert r2["answer"]["suggest_feedback"] is True
    assert len(seen_histories[1]) == 2
    assert seen_histories[1][0]["content"] == "Ngày 1 ăn gì?"
    assert seen_histories[1][0]["author_name"] == "Phúc"

    # GET /chat trả hội thoại chung theo thứ tự tăng dần
    st, listed = call(server, "GET", f"{T}/chat", token=phuc)
    assert st == 200 and len(listed["items"]) == 4

    # Trip khác không đọc được -> 404
    other = call(server, "POST", "/api/v1/trips", {**TRIP, "leader_name": "Lan"})[1]
    assert call(server, "GET", f"{T}/chat", token=other["token"])[0] == 404

    # Rate limit: Phúc đã hỏi 1 lần, hỏi thêm 5 lần nữa vẫn OK, lần thứ 7 trong phút -> 429
    for idx in range(5):
        st, _ = call(server, "POST", f"{T}/chat", {"message": f"Hỏi thêm {idx}"}, phuc)
        assert st == 200
    st, limited = call(server, "POST", f"{T}/chat", {"message": "Quá giới hạn"}, phuc)
    assert st == 429 and limited["error"]["code"] == "rate_limited"

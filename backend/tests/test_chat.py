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


def test_chat_draft_edit_and_proposals_draft_endpoint(server, monkeypatch):
    tid, leader, _ = ready_trip(server)
    T = f"/api/v1/trips/{tid}"

    import agent
    monkeypatch.setattr(
        agent,
        "call_model",
        lambda system, user: {"text": "", "model": "fake", "tokens_in": 0, "tokens_out": 0},
    )
    st, gen = call(server, "POST", f"{T}/generate", {}, leader)
    assert st == 200 and gen["status"] == "ok"
    st, v1_res = call(server, "POST", f"{T}/plan", {"plan": gen["draft"]["plan"]}, leader)
    assert st == 201
    target_item = v1_res["version"]["plan"]["days"][0]["items"][0]

    def fake_draft_plan_edit(request, plan=None, candidates=None, history=None, trip_meta=None):
        return {
            "can_edit": True,
            "answer": f"Mình đã soạn phương án đổi {target_item['name']} sang Quán mới.",
            "ops": [
                {
                    "op": "update_item",
                    "item_id": target_item["id"],
                    "set": {"name": "Quán Hải Sản Mới", "note": "Roa đổi theo yêu cầu"},
                }
            ],
            "summary": "Đổi sang Quán Hải Sản Mới",
            "reason": "Theo yêu cầu trong chat",
            "model": "gemini-3.8-flash",
            "tokens_in": 150,
            "tokens_out": 60,
        }

    monkeypatch.setattr(agent, "draft_plan_edit", fake_draft_plan_edit)

    # 1. Endpoint POST /proposals/draft hoạt động
    st, drafted_api = call(server, "POST", f"{T}/proposals/draft", {"request": "Đổi quán sáng"}, leader)
    assert st == 200
    assert drafted_api["base_version"] == 1
    assert drafted_api["summary"] == "Đổi sang Quán Hải Sản Mới"
    assert drafted_api["preview"]["changes"][0]["name"] == "Quán Hải Sản Mới"

    # 2. Nhắn trong chat yêu cầu sửa -> Roa trả về draft_proposal để bấm áp dụng
    st, chat_res = call(server, "POST", f"{T}/chat", {"message": "Thay đổi quán sáng sang quán khác"}, leader)
    assert st == 200
    ans = chat_res["answer"]
    assert "draft_proposal" in ans
    dp = ans["draft_proposal"]
    assert dp["base_version"] == 1 and dp["ops"]

    # 3. Tạo proposal + apply -> lên v2 bất biến
    st, prop = call(
        server,
        "POST",
        f"{T}/proposals",
        {
            "kind": "edit",
            "base_version": dp["base_version"],
            "ops": dp["ops"],
            "summary": dp["summary"],
            "reason": dp["reason"],
            "origin": "agent",
        },
        leader,
    )
    assert st == 201
    st, applied = call(server, "POST", f"/api/v1/proposals/{prop['id']}/apply", {}, leader)
    assert st == 200 and applied["new_version"] == 2
    st, v2 = call(server, "GET", f"{T}/plan", token=leader)
    assert st == 200 and v2["plan"]["days"][0]["items"][0]["name"] == "Quán Hải Sản Mới"

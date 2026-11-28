"""Luồng nhóm qua HTTP: tạo chuyến đi → Roa soạn nháp (model giả) → nhóm trưởng duyệt v1 → link mời →
thành viên đề xuất, bỏ phiếu → nhóm trưởng áp dụng → v2; quyền và hạn 48 giờ (CR-001)."""
from datetime import timedelta

import pytest

from app.db import base
from app.db.models import Proposal
from tests.test_api import TRIP, call, server  # noqa: F401  (fixture server)


@pytest.fixture(autouse=True)
def fake_model(monkeypatch):
    """Không gọi model thật: Roa dùng regex + bản nháp của code."""
    from app import roa  # noqa: F401  (đưa codebase/ vào sys.path)
    import agent
    monkeypatch.setattr(agent, "call_model", lambda system, user: {"text": "", "model": "fake",
                                                                   "tokens_in": 0, "tokens_out": 0})


def ready_trip(server):
    st, res = call(server, "POST", "/api/v1/trips", TRIP)
    assert st == 201
    tid, leader = res["trip"]["id"], res["token"]
    for _ in range(100):
        if call(server, "GET", f"/api/v1/trips/{tid}", token=leader)[1]["store"]["status"] == "ready":
            break
        __import__("time").sleep(0.05)
    return tid, leader, res["trip"]["invite_code"]


def first_item(plan, day=1, kind=None):
    return next(it for d in plan["days"] if d["day"] == day for it in d["items"] if kind is None or it["kind"] == kind)


def test_generate_approve_join_propose_vote_apply(server):
    tid, leader, code = ready_trip(server)
    T = f"/api/v1/trips/{tid}"

    # Roa soạn nháp: có khách sạn với giờ nhận phòng 14:00 ngày 1, trả phòng 12:00 ngày cuối.
    st, gen = call(server, "POST", f"{T}/generate", {}, leader)
    assert st == 200 and gen["status"] == "ok", gen
    draft = gen["draft"]["plan"]
    assert [d["date"] for d in draft["days"]] == ["2026-12-05", "2026-12-06"]
    checkin, checkout = first_item(draft, 1, "hotel"), first_item(draft, 2, "hotel")
    assert checkin["start"] == "14:00" and checkout["end"] == "12:00"
    assert "Nhận phòng" in checkin["name"] and "Trả phòng" in checkout["name"]
    assert gen["draft"]["lodging"]["checkin"] == "14:00"

    # Thành viên chưa vào nhóm; vào bằng link mời. Tên trùng → 409.
    assert call(server, "GET", f"/api/v1/join/{code}")[1]["member_count"] == 1
    st, j = call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Phúc"})
    assert st == 201 and j["member"]["role"] == "member"
    phuc = j["token"]
    assert call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Phúc"})[1]["error"]["code"] == "name_taken"
    toan = call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Toàn"})[1]["token"]

    # Chỉ nhóm trưởng gọi generate và duyệt v1.
    assert call(server, "POST", f"{T}/generate", {}, phuc)[1]["error"]["code"] == "not_leader"
    assert call(server, "POST", f"{T}/plan", {"plan": draft}, phuc)[1]["error"]["code"] == "not_leader"
    st, v1 = call(server, "POST", f"{T}/plan", {"plan": draft, "agent_run_id": gen["agent_run_id"]}, leader)
    assert st == 201 and v1["version"]["version_no"] == 1
    assert call(server, "POST", f"{T}/plan", {"plan": draft}, leader)[1]["error"]["code"] == "plan_exists"
    plan = call(server, "GET", f"{T}/plan", token=phuc)[1]["plan"]
    ids = [it["id"] for d in plan["days"] for it in d["items"]]
    assert all(i.startswith("itm_") for i in ids) and len(set(ids)) == len(ids)

    # Thành viên tạo thẻ đề xuất; tự tính đồng ý; hạn 48 giờ.
    target = next(it for d in plan["days"] for it in d["items"] if it["kind"] != "hotel")
    body = {"base_version": 1, "summary": "Ghi chú mang áo khoác",
            "ops": [{"op": "update_item", "item_id": target["id"], "set": {"note": "mang áo khoác"}}]}
    st, p = call(server, "POST", f"{T}/proposals", body, phuc)
    assert st == 201 and p["author"]["display_name"] == "Phúc" and p["my_vote"] == "agree"
    assert p["votes"] == {"agree": 1, "disagree": 0, "required": 2, "majority": False, "total_members": 3,
                          "pending": ["Đức", "Toàn"]}
    assert p["expires_at"] and p["preview"]["changes"][0]["type"] == "updated"
    P = f"/api/v1/proposals/{p['id']}"

    # Bỏ phiếu chỉ ghi nhận; thành viên không áp dụng được.
    st, voted = call(server, "PUT", f"{P}/vote", {"value": "agree"}, toan)
    assert st == 200 and voted["proposal"]["votes"]["majority"] and voted["proposal"]["status"] == "open"
    assert call(server, "POST", f"{P}/apply", None, phuc)[1]["error"]["code"] == "not_leader"
    assert call(server, "POST", f"{P}/close", None, toan)[1]["error"]["code"] == "not_leader"

    st, applied = call(server, "POST", f"{P}/apply", None, leader)
    assert st == 200 and applied["new_version"] == 2 and applied["proposal"]["status"] == "applied"
    v2 = call(server, "GET", f"{T}/plan", token=toan)[1]
    assert v2["version_no"] == 2 and v2["source"] == "proposal" and v2["proposal"]["number"] == 1
    assert any(it.get("note") == "mang áo khoác" for d in v2["plan"]["days"] for it in d["items"])
    assert call(server, "PUT", f"{P}/vote", {"value": "disagree"}, toan)[1]["error"]["code"] == "proposal_closed"
    assert [v["version_no"] for v in call(server, "GET", f"{T}/versions", token=phuc)[1]["items"]] == [2, 1]

    # Đề xuất cũ đụng cùng mục đã đổi → stale khi áp dụng.
    st, old = call(server, "POST", f"{T}/proposals", {**body, "summary": "Đổi ghi chú khác", "ops": [
        {"op": "update_item", "item_id": target["id"], "set": {"note": "khác"}}]}, toan)
    assert st == 201
    st, p3 = call(server, "POST", f"{T}/proposals", {"kind": "revert", "base_version": 2, "target_version": 1,
                                                    "summary": "Quay lại v1"}, phuc)
    assert st == 201
    st, applied = call(server, "POST", f"/api/v1/proposals/{p3['id']}/apply", None, leader)
    assert st == 200 and applied["new_version"] == 3
    st, got = call(server, "GET", f"/api/v1/proposals/{old['id']}", token=toan)
    assert got["status"] == "stale" and got["close_reason"] == "conflict" and got["voters"][0]["value"] == "agree"

    # Cập nhật: đủ loại sự kiện cho frontend.
    up = call(server, "GET", f"{T}/updates?since=0", token=phuc)[1]
    types = {e["type"] for e in up["events"]}
    assert {"store_ready", "member_joined", "version_created", "proposal_created", "vote_cast",
            "proposal_applied", "proposal_closed"} <= types and up["current_version"] == 3


def test_proposal_expires_after_48h(server):
    tid, leader, code = ready_trip(server)
    T = f"/api/v1/trips/{tid}"
    draft = call(server, "POST", f"{T}/generate", {}, leader)[1]["draft"]["plan"]
    call(server, "POST", f"{T}/plan", {"plan": draft}, leader)
    mem = call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Khương"})[1]["token"]
    item = first_item(call(server, "GET", f"{T}/plan", token=mem)[1]["plan"])
    st, p = call(server, "POST", f"{T}/proposals", {"base_version": 1, "summary": "Bỏ một điểm",
                                                   "ops": [{"op": "remove_item", "item_id": item["id"]}]}, mem)
    assert st == 201
    # Lùi thời gian tạo: đặt expires_at về quá khứ.
    s = base.session_factory()()
    row = s.get(Proposal, __import__("uuid").UUID(p["id"]))
    row.expires_at = row.created_at - timedelta(minutes=1)
    s.commit()
    s.close()
    P = f"/api/v1/proposals/{p['id']}"
    assert call(server, "GET", T, token=mem)[1]["counts"]["open_proposals"] == 0
    got = call(server, "GET", P, token=mem)[1]
    assert got["status"] == "reference" and got["close_reason"] == "expired"  # vẫn xem được
    st, err = call(server, "PUT", f"{P}/vote", {"value": "agree"}, leader)
    assert st == 410 and err["error"]["code"] == "proposal_closed"
    assert call(server, "POST", f"{P}/apply", None, leader)[0] == 410
    assert [x["id"] for x in call(server, "GET", f"{T}/proposals?status=closed", token=mem)[1]["items"]] == [p["id"]]


def test_custom_checkin_and_bad_ops(server):
    tid, leader, code = ready_trip(server)
    T = f"/api/v1/trips/{tid}"
    st, gen = call(server, "POST", f"{T}/generate", {"extra_request": "Nhận phòng lúc 16h, trả phòng lúc 10h"}, leader)
    assert st == 200 and gen["status"] == "ok", gen
    plan = gen["draft"]["plan"]
    assert first_item(plan, 1, "hotel")["start"] == "16:00" and first_item(plan, 2, "hotel")["end"] == "10:00"
    call(server, "POST", f"{T}/plan", {"plan": plan}, leader)
    st, err = call(server, "POST", f"{T}/proposals", {"base_version": 1, "summary": "x",
                                                     "ops": [{"op": "remove_item", "item_id": "itm_khongco"}]}, leader)
    assert st == 422 and err["error"]["code"] == "invalid_ops" and err["error"]["details"]["index"] == 0
    other = call(server, "POST", "/api/v1/trips", {**TRIP, "leader_name": "Lan"})[1]["token"]
    assert call(server, "GET", T, token=other)[0] == 404

"""Test API góp ý: tạo góp ý, phân quyền xem, xử lý noted/declined và chuyển thành đề xuất."""
from tests.test_api import call, server  # noqa: F401
from tests.test_group_flow import ready_trip


def test_suggestion_flow(server, monkeypatch):
    tid, leader, code = ready_trip(server)
    T = f"/api/v1/trips/{tid}"

    import agent
    monkeypatch.setattr(
        agent,
        "call_model",
        lambda system, user: {"text": "", "model": "fake", "tokens_in": 0, "tokens_out": 0},
    )
    st, gen = call(server, "POST", f"{T}/generate", {}, leader)
    assert st == 200 and gen["status"] == "ok"
    st, v1 = call(server, "POST", f"{T}/plan", {"plan": gen["draft"]["plan"]}, leader)
    assert st == 201
    target = v1["version"]["plan"]["days"][0]["items"][0]

    phuc = call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Phúc"})[1]["token"]
    khuong = call(server, "POST", f"/api/v1/join/{code}", {"display_name": "Khương"})[1]["token"]

    # Thành viên gửi góp ý gắn mục cụ thể
    st, s1 = call(
        server,
        "POST",
        f"{T}/suggestions",
        {
            "day": 1,
            "item_id": target["id"],
            "category": "replace",
            "content": "Ăn chỗ khác đi",
            "based_on_version": 1,
        },
        phuc,
    )
    assert st == 201
    assert s1["status"] == "new"
    assert s1["item_name"] == target["name"]
    assert s1["author"]["display_name"] == "Phúc"

    st, s2 = call(
        server,
        "POST",
        f"{T}/suggestions",
        {"day": 1, "item_id": None, "category": "other", "content": "Đi trễ hơn 30 phút", "based_on_version": 1},
        khuong,
    )
    assert st == 201

    # counts.new_suggestions = 2
    st, detail = call(server, "GET", T, token=leader)
    assert st == 200 and detail["counts"]["new_suggestions"] == 2

    # Phúc chỉ thấy góp ý của mình; nhóm trưởng thấy cả 2
    st, phuc_list = call(server, "GET", f"{T}/suggestions?status=all", token=phuc)
    assert st == 200 and len(phuc_list["items"]) == 1 and phuc_list["items"][0]["id"] == s1["id"]
    st, leader_list = call(server, "GET", f"{T}/suggestions?status=all", token=leader)
    assert st == 200 and len(leader_list["items"]) == 2

    # Thành viên không được xử lý góp ý -> 403
    st, _ = call(server, "PATCH", f"/api/v1/suggestions/{s2['id']}", {"status": "noted"}, phuc)
    assert st == 403

    # Nhóm trưởng ghi nhận s2 -> 200; xử lý lại lần 2 -> 409
    st, patched = call(
        server,
        "PATCH",
        f"/api/v1/suggestions/{s2['id']}",
        {"status": "noted", "leader_note": "Đã ghi nhận"},
        leader,
    )
    assert st == 200 and patched["status"] == "noted" and patched["leader_note"] == "Đã ghi nhận"
    st, again = call(server, "PATCH", f"/api/v1/suggestions/{s2['id']}", {"status": "declined"}, leader)
    assert st == 409

    # Nhóm trưởng chuyển s1 thành đề xuất -> s1 sang status="converted"
    st, prop = call(
        server,
        "POST",
        f"{T}/proposals",
        {
            "kind": "edit",
            "base_version": 1,
            "ops": [{"op": "update_item", "item_id": target["id"], "set": {"note": "Đổi theo góp ý Phúc"}}],
            "summary": "Sửa theo góp ý Phúc",
            "origin": "suggestion",
            "suggestion_id": s1["id"],
        },
        leader,
    )
    assert st == 201
    assert prop["suggestion"]["id"] == s1["id"]
    assert prop["suggestion"]["author"] == "Phúc"

    st, leader_after = call(server, "GET", f"{T}/suggestions?status=all", token=leader)
    conv = next(x for x in leader_after["items"] if x["id"] == s1["id"])
    assert conv["status"] == "converted" and conv["proposal"]["number"] == prop["number"]

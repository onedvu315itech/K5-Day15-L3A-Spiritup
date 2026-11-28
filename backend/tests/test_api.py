"""Smoke test HTTP thật: uvicorn trong thread + urllib (không thêm httpx)."""
import json
import socket
import threading
import time
import urllib.error
import urllib.request

import pytest
import uvicorn

from app.main import create_app
from tests.conftest import STORE_SIZE, FakeGeo


@pytest.fixture
def server(db_session, settings):
    app = create_app(settings=settings, geo_factory=lambda db: FakeGeo())
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    srv = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    th = threading.Thread(target=srv.run, daemon=True)
    th.start()
    for _ in range(100):
        if srv.started:
            break
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    srv.should_exit = True
    th.join(5)


def call(base, method, path, body=None, token=None):
    req = urllib.request.Request(base + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json",
                                          **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


TRIP = {"title": "Quy Nhơn 2N1Đ", "destination": "Quy Nhơn", "start_date": "2026-12-05", "end_date": "2026-12-06",
        "group_size": 4, "budget_per_person": 2000000, "leader_name": "Đức"}


def test_trip_store_flow(server):
    assert call(server, "GET", "/health") == (200, {"status": "ok", "db": "ok"})
    st, res = call(server, "POST", "/api/v1/trips", TRIP)
    assert st == 201
    assert res["trip"]["generation_status"] == "collecting_data" and res["store"]["status"] == "collecting"
    assert res["invite_url"] == f"http://fe.test/join/{res['trip']['invite_code']}"
    # BackgroundTasks chạy sau khi trả response; chờ kho ready.
    for _ in range(100):
        st, store = call(server, "GET", "/api/v1/cities/quy-nhon/store")
        if store["status"] == "ready":
            break
        time.sleep(0.05)
    assert store["status"] == "ready" and store["place_count"] == STORE_SIZE
    st, places = call(server, "GET", "/api/v1/cities/quy-nhon/places?geo_category=catering.cafe")
    assert st == 200 and len(places["items"]) == 2 and "OpenStreetMap" in places["attribution"]
    assert places["items"][1]["open"] is None and places["items"][1]["hours_unverified"] is True

    tid, token = res["trip"]["id"], res["token"]
    assert call(server, "POST", f"/api/v1/trips/{tid}/store/retry", token=token)[0] == 200
    assert call(server, "POST", f"/api/v1/trips/{tid}/store/retry")[0] == 401
    assert call(server, "POST", f"/api/v1/trips/{tid}/store/retry", token="sai")[1]["error"]["code"] == "unauthorized"
    other = call(server, "POST", "/api/v1/trips", {**TRIP, "leader_name": "Lan"})[1]
    st, err = call(server, "POST", f"/api/v1/trips/{tid}/store/retry", token=other["token"])
    assert st == 404 and err["error"]["code"] == "not_found"


def test_errors(server):
    st, err = call(server, "POST", "/api/v1/trips", {**TRIP, "destination": "Atlantis"})
    assert st == 422 and err["error"]["code"] == "unknown_destination"
    st, err = call(server, "POST", "/api/v1/trips", {**TRIP, "group_size": 1})
    assert st == 400 and err["error"]["code"] == "bad_request" and err["error"]["details"]["fields"]
    st, err = call(server, "POST", "/api/v1/trips", {**TRIP, "end_date": "2026-12-01"})
    assert st == 400
    assert call(server, "GET", "/api/v1/cities/khong-co/store")[0] == 404
    assert call(server, "GET", "/api/v1/cities/khong-co/places")[0] == 404
    assert call(server, "GET", "/api/v1/khong-co")[1]["error"]["code"] == "not_found"

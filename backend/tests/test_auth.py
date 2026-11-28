"""Kiểm thử xác thực cookie HttpOnly (`access_token` + `refresh_token`) và seed từ EMAIL/PASSWORD."""
import http.cookiejar
import json
import socket
import threading
import time
import urllib.error
import urllib.request

import pytest
import uvicorn

from app.config import Settings
from app.db import base
from app.db.models import User
from app.main import create_app
from tests.conftest import FakeGeo


@pytest.fixture
def auth_server(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'auth.db').as_posix()}",
        geoapify_api_key="",
        frontend_base_url="http://fe.test",
        cors_origins="http://fe.test",
        store_ttl_days=None,
        tavily_api_key="",
        email="Admin@Partaway.vn",
        password="secret-password-123",
        auth_secret_key="test-cookie-secret-key",
    )
    engine = base.init_engine(settings.database_url)
    base.Base.metadata.create_all(engine)

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

    yield f"http://127.0.0.1:{port}", settings

    srv.should_exit = True
    th.join(5)
    engine.dispose()


def cookie_client():
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def request(base_url: str, method: str, path: str, body: dict | None = None, headers: dict | None = None):
        req = urllib.request.Request(
            base_url + path,
            method=method,
            data=json.dumps(body).encode("utf-8") if body is not None else None,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        try:
            with opener.open(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read()), resp.headers
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read()), err.headers

    return jar, request


def test_seed_login_me_refresh_and_logout(auth_server):
    base_url, _ = auth_server

    # Tài khoản từ EMAIL/PASSWORD đã được seed vào DB lúc khởi động server
    db = base.session_factory()()
    try:
        seeded = db.query(User).filter(User.email == "admin@partaway.vn").one_or_none()
        assert seeded is not None
        assert seeded.display_name == "admin"
    finally:
        db.close()

    jar, call = cookie_client()

    # Chưa đăng nhập → /api/auth/me trả 401
    st, err, _ = call(base_url, "GET", "/api/auth/me")
    assert st == 401 and err["error"]["code"] == "unauthorized"

    # Sai mật khẩu → 401 invalid_credentials
    st, err, _ = call(base_url, "POST", "/api/auth/login", {"email": "admin@partaway.vn", "password": "wrong"})
    assert st == 401 and err["error"]["code"] == "invalid_credentials"

    # Đăng nhập đúng → đặt cả 2 cookie HttpOnly access_token + refresh_token
    st, data, headers = call(
        base_url,
        "POST",
        "/api/auth/login",
        {"email": "ADMIN@partaway.vn", "password": "secret-password-123", "remember_me": True},
        headers={"Origin": "http://fe.test"},
    )
    assert st == 200
    assert data["user"]["email"] == "admin@partaway.vn"
    assert headers.get("Access-Control-Allow-Credentials") == "true"
    cookie_names = {c.name for c in jar}
    assert {"access_token", "refresh_token"} <= cookie_names
    set_cookies = headers.get_all("Set-Cookie") or []
    assert any("access_token=" in c and "HttpOnly" in c for c in set_cookies)
    assert any("refresh_token=" in c and "HttpOnly" in c for c in set_cookies)

    # /api/auth/me đọc cookie và trả đúng user
    st, me_res, _ = call(base_url, "GET", "/api/auth/me")
    assert st == 200 and me_res["user"]["email"] == "admin@partaway.vn"

    # Xoá access_token khỏi jar (giả lập access_token hết hạn) → /api/auth/me tự cấp mới nhờ refresh_token
    for c in list(jar):
        if c.name == "access_token":
            jar.clear(c.domain, c.path, c.name)
    assert "access_token" not in {c.name for c in jar}
    st, me_renewed, _ = call(base_url, "GET", "/api/auth/me")
    assert st == 200 and me_renewed["user"]["email"] == "admin@partaway.vn"
    assert "access_token" in {c.name for c in jar}

    # Xoay vòng phiên qua /api/auth/refresh → refresh_token cũ bị thu hồi
    old_refresh = next(c.value for c in jar if c.name == "refresh_token")
    st, ref_res, _ = call(base_url, "POST", "/api/auth/refresh")
    assert st == 200 and ref_res["user"]["email"] == "admin@partaway.vn"
    new_refresh = next(c.value for c in jar if c.name == "refresh_token")
    assert new_refresh != old_refresh

    # Đăng xuất → thu hồi refresh_token trong DB và xoá cookie; gọi lại /api/auth/me trả 401
    st, out_res, _ = call(base_url, "POST", "/api/auth/logout")
    assert st == 200 and out_res == {"ok": True}
    st, _, _ = call(base_url, "GET", "/api/auth/me")
    assert st == 401

"""Xác thực tài khoản (`users`, `auth_refresh_tokens`) qua cookie `access_token` + `refresh_token`."""
import base64
from datetime import timedelta
import hashlib
import hmac
import json
import logging
import secrets
import uuid

from app.db.base import session_factory, utcnow
from app.db.models import AuthRefreshToken, User
from app.errors import ApiError

logger = logging.getLogger(__name__)
PBKDF2_ITERATIONS = 200_000


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iter_str, salt, hex_digest = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        expected = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iter_str)).hex()
        return hmac.compare_digest(expected, hex_digest)
    except (ValueError, TypeError):
        return False


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    pad = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode((segment + pad).encode("ascii"))


def create_access_token(user: User, settings) -> tuple[str, int]:
    now = utcnow()
    max_age = max(60, int(settings.access_token_ttl_minutes) * 60)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=max_age)).timestamp()),
        "typ": "access",
    }
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(settings.auth_secret_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64url_encode(sig)}", max_age


def decode_access_token(token: str, settings) -> dict | None:
    if not token or "." not in token:
        return None
    body, sig_part = token.split(".", 1)
    expected_sig = hmac.new(settings.auth_secret_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(sig_part)
    except Exception:
        return None
    if not hmac.compare_digest(expected_sig, actual_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(body).decode("utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict) or payload.get("typ") != "access":
        return None
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(utcnow().timestamp()):
        return None
    return payload


def user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "created_at": user.created_at.isoformat(),
    }


def ensure_seed_user(db, settings) -> User | None:
    """Đồng bộ tài khoản từ EMAIL/PASSWORD trong .env vào bảng `users` (nếu có cấu hình)."""
    raw_email = (settings.email or "").strip()
    raw_password = settings.password or ""
    if not raw_email or not raw_password:
        return None
    email = normalize_email(raw_email)
    user = db.query(User).filter(User.email == email).one_or_none()
    default_name = email.split("@", 1)[0] if "@" in email else email
    if user is None:
        user = User(email=email, password_hash=hash_password(raw_password), display_name=default_name,
                    created_at=utcnow())
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    if not verify_password(raw_password, user.password_hash):
        user.password_hash = hash_password(raw_password)
        db.commit()
        db.refresh(user)
    return user


def seed_on_startup(settings) -> None:
    """Khởi tạo sẵn user từ .env khi ứng dụng bật (bỏ qua êm nếu DB chưa chạy migration)."""
    if not (settings.email or "").strip() or not (settings.password or ""):
        return
    try:
        from app.db.base import init_engine
        init_engine(settings.database_url)
        db = session_factory()()
        try:
            ensure_seed_user(db, settings)
        finally:
            db.close()
    except Exception as exc:
        logger.debug("Bỏ qua seed user lúc khởi động (có thể chưa chạy migration): %s", exc)


def _issue_refresh_token(db, user: User, settings, remember_me: bool = True) -> tuple[str, int | None]:
    raw_token = secrets.token_urlsafe(32)
    now = utcnow()
    ttl_days = max(1, int(settings.refresh_token_ttl_days)) if remember_me else 1
    expires_at = now + timedelta(days=ttl_days)
    row = AuthRefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw_token),
        expires_at=expires_at,
        created_at=now,
    )
    db.add(row)
    max_age = ttl_days * 86400 if remember_me else None
    return raw_token, max_age


def login(db, settings, email: str, password: str, remember_me: bool = True):
    ensure_seed_user(db, settings)
    norm_email = normalize_email(email)
    user = db.query(User).filter(User.email == norm_email).one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise ApiError(401, "invalid_credentials", "Email hoặc mật khẩu không đúng.")
    access_token, access_max_age = create_access_token(user, settings)
    refresh_token, refresh_max_age = _issue_refresh_token(db, user, settings, remember_me=remember_me)
    db.commit()
    return user, access_token, refresh_token, access_max_age, refresh_max_age


def _valid_refresh_row(db, refresh_token: str | None) -> AuthRefreshToken | None:
    if not refresh_token:
        return None
    row = (
        db.query(AuthRefreshToken)
        .filter(AuthRefreshToken.token_hash == _hash_refresh_token(refresh_token))
        .one_or_none()
    )
    if row is None or row.revoked_at is not None or row.expires_at <= utcnow():
        return None
    return row


def authenticate_cookies(db, settings, access_token: str | None, refresh_token: str | None):
    """Trả `(user, new_access_tuple_or_None)`. Nếu `access_token` hết hạn nhưng `refresh_token` còn hạn thì cấp lại."""
    if access_token:
        payload = decode_access_token(access_token, settings)
        if payload and payload.get("sub"):
            try:
                uid = uuid.UUID(str(payload["sub"]))
            except ValueError:
                uid = None
            if uid is not None:
                user = db.get(User, uid)
                if user is not None:
                    return user, None

    row = _valid_refresh_row(db, refresh_token)
    if row is not None:
        user = db.get(User, row.user_id)
        if user is not None:
            new_access, access_max_age = create_access_token(user, settings)
            return user, (new_access, access_max_age)

    raise ApiError(401, "unauthorized", "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.")


def refresh_session(db, settings, refresh_token: str | None):
    """Xoay vòng `refresh_token` và cấp mới `access_token`."""
    row = _valid_refresh_row(db, refresh_token)
    if row is None:
        raise ApiError(401, "unauthorized", "Phiên làm mới không hợp lệ hoặc đã hết hạn.")
    user = db.get(User, row.user_id)
    if user is None:
        raise ApiError(401, "unauthorized", "Tài khoản không tồn tại.")
    row.revoked_at = utcnow()
    new_access, access_max_age = create_access_token(user, settings)
    new_refresh, refresh_max_age = _issue_refresh_token(db, user, settings, remember_me=True)
    db.commit()
    return user, new_access, new_refresh, access_max_age, refresh_max_age


def logout(db, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    row = (
        db.query(AuthRefreshToken)
        .filter(AuthRefreshToken.token_hash == _hash_refresh_token(refresh_token))
        .one_or_none()
    )
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()
        db.commit()

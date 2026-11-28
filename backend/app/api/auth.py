"""Xác thực bằng cookie HttpOnly (`access_token` + `refresh_token`): `/api/auth/*`."""
from typing import Literal, cast

from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel, Field

from app.api.deps import settings_of
from app.db.base import get_db
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
SameSitePolicy = Literal["lax", "strict", "none"]


def _samesite(settings) -> SameSitePolicy:
    val = (settings.cookie_samesite or "lax").strip().lower()
    if val in ("lax", "strict", "none"):
        return cast(SameSitePolicy, val)
    return "lax"


def _set_access_cookie(response: Response, token: str, max_age: int, settings) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=bool(settings.cookie_secure),
        samesite=_samesite(settings),
        path="/",
    )


def _set_refresh_cookie(response: Response, token: str, max_age: int | None, settings) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=bool(settings.cookie_secure),
        samesite=_samesite(settings),
        path="/",
    )


def _clear_auth_cookies(response: Response, settings) -> None:
    samesite = _samesite(settings)
    secure = bool(settings.cookie_secure)
    response.delete_cookie(key=ACCESS_COOKIE, path="/", httponly=True, secure=secure, samesite=samesite)
    response.delete_cookie(key=REFRESH_COOKIE, path="/", httponly=True, secure=secure, samesite=samesite)


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=200)
    remember_me: bool = True


@router.post("/login")
def login(body: LoginRequest, response: Response, db=Depends(get_db), settings=Depends(settings_of)):
    user, access_token, refresh_token, access_max_age, refresh_max_age = auth_service.login(
        db, settings, body.email, body.password, remember_me=body.remember_me
    )
    _set_access_cookie(response, access_token, access_max_age, settings)
    _set_refresh_cookie(response, refresh_token, refresh_max_age, settings)
    return {"user": auth_service.user_dict(user)}


@router.get("/me")
def me(
    response: Response,
    access_token: str | None = Cookie(default=None),
    refresh_token: str | None = Cookie(default=None),
    db=Depends(get_db),
    settings=Depends(settings_of),
):
    user, renewed_access = auth_service.authenticate_cookies(db, settings, access_token, refresh_token)
    if renewed_access is not None:
        token, max_age = renewed_access
        _set_access_cookie(response, token, max_age, settings)
    return {"user": auth_service.user_dict(user)}


@router.post("/refresh")
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db=Depends(get_db),
    settings=Depends(settings_of),
):
    user, access_tok, new_refresh_tok, access_max_age, refresh_max_age = auth_service.refresh_session(
        db, settings, refresh_token
    )
    _set_access_cookie(response, access_tok, access_max_age, settings)
    _set_refresh_cookie(response, new_refresh_tok, refresh_max_age, settings)
    return {"user": auth_service.user_dict(user)}


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db=Depends(get_db),
    settings=Depends(settings_of),
):
    auth_service.logout(db, refresh_token)
    _clear_auth_cookies(response, settings)
    return {"ok": True}

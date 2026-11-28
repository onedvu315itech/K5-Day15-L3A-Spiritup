"""Dependency dùng chung cho router."""
import uuid

from fastapi import Depends, Header, Request

from app.db.base import get_db
from app.db.models import Trip
from app.errors import ApiError
from app.services import trip_service


def settings_of(request: Request):
    return request.app.state.settings


def geo_of(request: Request, db=Depends(get_db)):
    return request.app.state.geo_factory(db)


def current_member(trip_id: uuid.UUID, authorization: str | None = Header(default=None), db=Depends(get_db)):
    member = trip_service.authenticate(db, trip_id, authorization)
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise ApiError(404, "not_found", "Không tìm thấy chuyến đi.")
    return trip, member


def schedule_store_job(request: Request, background, city_slug: str, job: str | None) -> None:
    """Chạy đợt thu ở nền với session riêng (không dùng session của request)."""
    if job:
        from app.services.place_service import run_collection
        from app.db.base import session_factory
        background.add_task(run_collection, city_slug, job, session_factory(), request.app.state.geo_factory,
                            request.app.state.settings)

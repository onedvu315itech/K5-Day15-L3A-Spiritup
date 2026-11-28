"""Kho địa điểm (docs/API_SPEC.md mục 2a). Không cần token: dữ liệu chung, không có thông tin cá nhân."""
import re

from fastapi import APIRouter, Depends, Query

from app.db.base import get_db
from app.db.models import PLACE_CATEGORIES
from app.errors import ApiError
from app.services import place_service
from app.services.geoapify import ATTRIBUTION

router = APIRouter(prefix="/api/v1")
GEO_CATEGORY = re.compile(r"^[a-z_]+(\.[a-z_]+)*$")


def _store_or_404(db, city_slug):
    store = place_service.get_store(db, city_slug)
    if store is None:
        raise ApiError(404, "not_found", "Chưa có kho địa điểm cho thành phố này.")
    return store


@router.get("/cities/{city_slug}/store")
def get_store(city_slug: str, db=Depends(get_db)):
    return place_service.store_dict(_store_or_404(db, city_slug))


@router.get("/cities/{city_slug}/places")
def list_places(city_slug: str, category: str | None = None, geo_category: str | None = None,
                limit: int = Query(default=50, ge=1, le=200), db=Depends(get_db)):
    _store_or_404(db, city_slug)
    if category and category not in PLACE_CATEGORIES:
        raise ApiError(400, "bad_request", "category không hợp lệ.", {"allowed": list(PLACE_CATEGORIES)})
    if geo_category and not GEO_CATEGORY.match(geo_category):
        raise ApiError(400, "bad_request", "geo_category không hợp lệ (ví dụ: catering.cafe).")
    rows = place_service.list_places(db, city_slug, category, geo_category, limit)
    return {"items": [place_service.place_dict(p) for p in rows], "attribution": ATTRIBUTION}

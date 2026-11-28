"""Chuyến đi (docs/API_SPEC.md mục 2)."""
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from app.api.deps import current_member, geo_of, schedule_store_job, settings_of
from app.db.base import get_db
from app.services import place_service, trip_service

router = APIRouter(prefix="/api/v1")


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    destination: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date
    group_size: int = Field(ge=2, le=20)
    budget_per_person: int | None = Field(default=None, ge=0)
    preferences: dict = Field(default_factory=dict)
    leader_name: str = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date phải không trước start_date")
        if not self.title.strip() or not self.destination.strip() or not self.leader_name.strip():
            raise ValueError("title, destination, leader_name không được để trống")
        return self


@router.post("/trips", status_code=201)
def create_trip(body: TripCreate, request: Request, background: BackgroundTasks, db=Depends(get_db),
                geo=Depends(geo_of), settings=Depends(settings_of)):
    trip, member, token, store, job = trip_service.create_trip(db, body, geo, settings)
    schedule_store_job(request, background, store.city_slug, job)
    base = settings.frontend_base_url.rstrip("/")
    return {"trip": trip_service.trip_dict(trip), "store": place_service.store_dict(store),
            "member": trip_service.member_dict(member), "token": token,
            "invite_url": f"{base}/join/{trip.invite_code}"}


@router.post("/trips/{trip_id}/store/retry")
def retry_store(request: Request, background: BackgroundTasks, auth=Depends(current_member), db=Depends(get_db),
                settings=Depends(settings_of)):
    trip, member = auth
    status, store, job = trip_service.retry_store(db, trip, member, settings)
    schedule_store_job(request, background, store.city_slug, job)
    return JSONResponse(status_code=status, content={"store": place_service.store_dict(store)})

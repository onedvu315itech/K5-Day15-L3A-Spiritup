"""Góp ý của thành viên (docs/API_SPEC.md mục 5)."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.deps import current_member, token_member
from app.db.base import get_db
from app.services import suggestion_service

router = APIRouter(prefix="/api/v1")


class SuggestionCreateBody(BaseModel):
    day: int | None = Field(default=None, ge=1)
    item_id: str | None = None
    category: Literal["add", "remove", "change_time", "replace", "other"] = "other"
    content: str = Field(min_length=1, max_length=1000)
    based_on_version: int = Field(ge=1)


class SuggestionPatchBody(BaseModel):
    status: Literal["noted", "declined"]
    leader_note: str | None = Field(default=None, max_length=500)


@router.post("/trips/{trip_id}/suggestions", status_code=201)
def create_suggestion(body: SuggestionCreateBody, auth=Depends(current_member), db=Depends(get_db)):
    trip, member = auth
    return suggestion_service.create(db, trip, member, body)


@router.get("/trips/{trip_id}/suggestions")
def list_suggestions(
    status: Literal["new", "converted", "noted", "declined", "all"] | None = Query(default=None),
    auth=Depends(current_member),
    db=Depends(get_db),
):
    trip, member = auth
    return {"items": suggestion_service.list_for(db, trip, member, status)}


@router.patch("/suggestions/{suggestion_id}")
def patch_suggestion(
    suggestion_id: uuid.UUID,
    body: SuggestionPatchBody,
    member=Depends(token_member),
    db=Depends(get_db),
):
    s = suggestion_service.load(db, member, suggestion_id)
    return suggestion_service.handle(db, member, s, body.status, body.leader_note)

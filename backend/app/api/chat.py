"""Hội thoại chung với Roa (docs/API_SPEC.md mục 6)."""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.deps import current_member
from app.db.base import get_db
from app.services import chat_service

router = APIRouter(prefix="/api/v1")


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


@router.post("/trips/{trip_id}/chat")
def post_chat(body: ChatBody, auth=Depends(current_member), db=Depends(get_db)):
    trip, member = auth
    return chat_service.send_message(db, trip, member, body.message)


@router.get("/trips/{trip_id}/chat")
def get_chat(
    before: int | None = Query(default=None, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
    auth=Depends(current_member),
    db=Depends(get_db),
):
    trip, _ = auth
    return {"items": chat_service.list_messages(db, trip, before=before, limit=limit)}

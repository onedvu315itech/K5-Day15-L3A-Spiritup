"""Tham gia nhóm, xem chuyến đi, plan, phiên bản, đề xuất, cập nhật (docs/API_SPEC.md mục 2–4, 7)."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from pydantic import BaseModel, Field

from app.api.deps import current_member, settings_of, token_member
from app.db.base import get_db
from app.services import plan_service, proposal_service, trip_service

router = APIRouter(prefix="/api/v1")


class JoinBody(BaseModel):
    display_name: str = Field(min_length=1, max_length=50)


class GenerateBody(BaseModel):
    extra_request: str | None = Field(default=None, max_length=1000)


class ApproveBody(BaseModel):
    plan: dict
    agent_run_id: str | None = None


class ProposalBody(BaseModel):
    kind: Literal["edit", "revert"] = "edit"
    base_version: int
    target_version: int | None = None
    ops: list[dict] | None = None
    summary: str = Field(min_length=1, max_length=300)
    reason: str | None = Field(default=None, max_length=1000)
    origin: Literal["manual", "agent"] = "manual"


class VoteBody(BaseModel):
    value: Literal["agree", "disagree"]


# ---------------------------------------------------------------- tham gia, chuyến đi

@router.get("/join/{invite_code}")
def join_preview(invite_code: str, db=Depends(get_db)):
    return trip_service.join_preview(db, invite_code)


@router.post("/join/{invite_code}", status_code=201)
def join(invite_code: str, body: JoinBody, db=Depends(get_db)):
    trip, member, token = trip_service.join(db, invite_code, body.display_name)
    return {"trip_id": str(trip.id), "member": trip_service.member_dict(member), "token": token}


@router.get("/trips/{trip_id}")
def get_trip(auth=Depends(current_member), db=Depends(get_db)):
    trip, member = auth
    return trip_service.trip_detail(db, trip, member)


@router.get("/trips/{trip_id}/updates")
def updates(since: int = Query(default=0, ge=0), auth=Depends(current_member), db=Depends(get_db)):
    return trip_service.updates(db, auth[0], since)


# ---------------------------------------------------------------- plan, phiên bản

@router.post("/trips/{trip_id}/generate")
def generate(body: GenerateBody | None = None, auth=Depends(current_member), db=Depends(get_db)):
    trip, member = auth
    return plan_service.generate(db, trip, member, body.extra_request if body else None)


@router.post("/trips/{trip_id}/plan", status_code=201)
def approve(body: ApproveBody, auth=Depends(current_member), db=Depends(get_db)):
    trip, member = auth
    return {"version": plan_service.approve(db, trip, member, body.plan)}


@router.get("/trips/{trip_id}/plan")
def get_plan(version: int | None = Query(default=None, ge=1), auth=Depends(current_member), db=Depends(get_db)):
    trip = auth[0]
    return plan_service.version_dict(db, trip, plan_service.get_version(db, trip, version))


@router.get("/trips/{trip_id}/versions")
def versions(auth=Depends(current_member), db=Depends(get_db)):
    return {"items": plan_service.list_versions(db, auth[0])}


@router.get("/trips/{trip_id}/versions/{n}/diff")
def version_diff(n: int, against: int | None = Query(default=None, ge=1), auth=Depends(current_member),
                 db=Depends(get_db)):
    return plan_service.version_diff(db, auth[0], n, against)


# ---------------------------------------------------------------- đề xuất (CR-001: mọi thành viên tạo)

@router.post("/trips/{trip_id}/proposals", status_code=201)
def create_proposal(body: ProposalBody, auth=Depends(current_member), db=Depends(get_db),
                    settings=Depends(settings_of)):
    trip, member = auth
    return proposal_service.create(db, trip, member, body, settings)


@router.get("/trips/{trip_id}/proposals")
def list_proposals(status: Literal["open", "closed", "all"] = "open", auth=Depends(current_member),
                   db=Depends(get_db)):
    trip, member = auth
    return {"items": proposal_service.list_for(db, trip, member, status)}


@router.get("/proposals/{proposal_id}")
def get_proposal(proposal_id: uuid.UUID, member=Depends(token_member), db=Depends(get_db)):
    return proposal_service.get(db, member, proposal_service.load(db, member, proposal_id))


@router.put("/proposals/{proposal_id}/vote")
def vote(proposal_id: uuid.UUID, body: VoteBody, member=Depends(token_member), db=Depends(get_db)):
    p = proposal_service.load(db, member, proposal_id)
    return {"proposal": proposal_service.vote(db, member, p, body.value)}


@router.post("/proposals/{proposal_id}/apply")
def apply(proposal_id: uuid.UUID, member=Depends(token_member), db=Depends(get_db)):
    return proposal_service.apply(db, member, proposal_service.load(db, member, proposal_id))


@router.post("/proposals/{proposal_id}/close")
def close(proposal_id: uuid.UUID, member=Depends(token_member), db=Depends(get_db)):
    return proposal_service.close(db, member, proposal_service.load(db, member, proposal_id))


@router.post("/proposals/{proposal_id}/withdraw")
def withdraw(proposal_id: uuid.UUID, member=Depends(token_member), db=Depends(get_db)):
    return proposal_service.withdraw(db, member, proposal_service.load(db, member, proposal_id))

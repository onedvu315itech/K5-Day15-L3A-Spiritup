"""13 bảng theo docs/DATABASE.md mục 2. Đổi cột thì sửa tài liệu và thêm migration Alembic cùng PR (R-04)."""
import uuid

from sqlalchemy import (Boolean, CheckConstraint, Date, Double, ForeignKey, Index, Integer, Text, UniqueConstraint,
                        Uuid, text)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BigId, Base, JSONType, UTCDateTime, utcnow


def _in(col: str, values) -> str:
    return f"{col} IN ({', '.join(repr(v) for v in values)})"


GENERATION_STATUS = ("collecting_data", "idle", "running", "done", "failed")
STORE_STATUS = ("collecting", "ready", "failed")
PLACE_CATEGORIES = ("food", "snack", "cafe", "sightseeing", "activity", "lodging")
EVENT_TYPES = ("member_joined", "version_created", "proposal_created", "vote_cast", "proposal_applied",
               "proposal_closed", "suggestion_created", "suggestion_handled", "chat_message", "store_ready",
               "store_failed")


class CityStore(Base):
    """2.12 — trạng thái kho địa điểm của một thành phố."""
    __tablename__ = "city_stores"
    __table_args__ = (CheckConstraint(_in("status", STORE_STATUS), name="ck_city_stores_status"),)

    city_slug: Mapped[str] = mapped_column(Text, primary_key=True)
    city_name: Mapped[str] = mapped_column(Text, nullable=False)
    geo_place_id: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Double)
    lon: Mapped[float | None] = mapped_column(Double)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    place_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    started_at = mapped_column(UTCDateTime)
    fetched_at = mapped_column(UTCDateTime)
    expires_at = mapped_column(UTCDateTime)
    error: Mapped[str | None] = mapped_column(Text)


class Place(Base):
    """2.13 — kho địa điểm đã lọc. `ref` là `id` công cụ của Roa trả về."""
    __tablename__ = "places"
    __table_args__ = (
        UniqueConstraint("city_slug", "ref", name="uq_places_city_ref"),
        Index("ix_places_city_category_rank", "city_slug", "category", "rank"),
        Index("ix_places_city_geo_category", "city_slug", "geo_category"),
        CheckConstraint(_in("category", PLACE_CATEGORIES), name="ck_places_category"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    city_slug: Mapped[str] = mapped_column(ForeignKey("city_stores.city_slug"), nullable=False)
    ref: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    geo_category: Mapped[str | None] = mapped_column(Text)
    geo_categories = mapped_column(JSONType, nullable=False, default=list, server_default=text("'[]'"))
    area: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Double)
    lon: Mapped[float | None] = mapped_column(Double)
    open_min: Mapped[int | None] = mapped_column(Integer)
    close_min: Mapped[int | None] = mapped_column(Integer)
    opening_hours_raw: Mapped[str | None] = mapped_column(Text)
    hours_unverified: Mapped[bool] = mapped_column(Boolean, nullable=False)
    avg_price_vnd: Mapped[int | None] = mapped_column(Integer)
    # Chỉ chỗ ở: khoảng giá phòng/đêm tra web lúc thu kho (Tavily), luôn chưa xác minh.
    price_min_vnd: Mapped[int | None] = mapped_column(Integer)
    price_max_vnd: Mapped[int | None] = mapped_column(Integer)
    price_source_url: Mapped[str | None] = mapped_column(Text)
    price_unverified: Mapped[bool] = mapped_column(Boolean, nullable=False)
    vegetarian_friendly: Mapped[bool | None] = mapped_column(Boolean)
    is_hot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    website: Mapped[str | None] = mapped_column(Text)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    fetched_at = mapped_column(UTCDateTime, nullable=False)


class Trip(Base):
    """2.1"""
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_trips_dates"),
        CheckConstraint("group_size BETWEEN 2 AND 20", name="ck_trips_group_size"),
        CheckConstraint(_in("generation_status", GENERATION_STATUS), name="ck_trips_generation_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    destination: Mapped[str] = mapped_column(Text, nullable=False)
    city_slug: Mapped[str] = mapped_column(ForeignKey("city_stores.city_slug"), nullable=False, index=True)
    start_date = mapped_column(Date, nullable=False)
    end_date = mapped_column(Date, nullable=False)
    group_size: Mapped[int] = mapped_column(Integer, nullable=False)
    budget_per_person: Mapped[int | None] = mapped_column(Integer)
    preferences = mapped_column(JSONType, nullable=False, default=dict, server_default=text("'{}'"))
    invite_code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    generation_status: Mapped[str] = mapped_column(Text, nullable=False, default="idle", server_default="idle")
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class TripMember(Base):
    """2.2 — mỗi trip đúng một leader (I3)."""
    __tablename__ = "trip_members"
    __table_args__ = (
        UniqueConstraint("trip_id", "display_name", name="uq_trip_members_name"),
        CheckConstraint(_in("role", ("leader", "member")), name="ck_trip_members_role"),
        Index("uq_trip_members_one_leader", "trip_id", unique=True,
              postgresql_where=text("role = 'leader'"), sqlite_where=text("role = 'leader'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    joined_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class PlanVersion(Base):
    """2.3 — bất biến (I1): chỉ thêm, không UPDATE."""
    __tablename__ = "plan_versions"
    __table_args__ = (
        UniqueConstraint("trip_id", "version_no", name="uq_plan_versions_no"),
        CheckConstraint(_in("source", ("generate", "proposal", "revert")), name="ck_plan_versions_source"),
        CheckConstraint("source = 'generate' OR proposal_id IS NOT NULL", name="ck_plan_versions_proposal"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    plan = mapped_column(JSONType, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("proposals.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_members.id"), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class Proposal(Base):
    """2.4"""
    __tablename__ = "proposals"
    __table_args__ = (
        UniqueConstraint("trip_id", "number", name="uq_proposals_number"),
        CheckConstraint(_in("kind", ("edit", "revert")), name="ck_proposals_kind"),
        CheckConstraint(_in("origin", ("manual", "agent", "suggestion")), name="ck_proposals_origin"),
        CheckConstraint(_in("status", ("open", "applied", "reference", "stale", "withdrawn")),
                        name="ck_proposals_status"),
        CheckConstraint("close_reason IS NULL OR " + _in("close_reason", ("leader_closed", "expired", "conflict",
                                                                          "withdrawn")),
                        name="ck_proposals_close_reason"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    origin: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_members.id"), nullable=False)
    base_version: Mapped[int] = mapped_column(Integer, nullable=False)
    target_version: Mapped[int | None] = mapped_column(Integer)
    ops = mapped_column(JSONType)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    warnings = mapped_column(JSONType, nullable=False, default=list, server_default=text("'[]'"))
    # Vòng FK proposals ↔ suggestions: khoá này thêm sau khi tạo cả hai bảng.
    suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("suggestions.id", use_alter=True, name="fk_proposals_suggestion_id"))
    required_votes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open", server_default="open")
    close_reason: Mapped[str | None] = mapped_column(Text)
    applied_version: Mapped[int | None] = mapped_column(Integer)
    votes_at_decision = mapped_column(JSONType)
    expires_at = mapped_column(UTCDateTime)
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    closed_at = mapped_column(UTCDateTime)


class Vote(Base):
    """2.5 — một phiếu một người một đề xuất (I4)."""
    __tablename__ = "votes"
    __table_args__ = (CheckConstraint(_in("value", ("agree", "disagree")), name="ck_votes_value"),)

    proposal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proposals.id"), primary_key=True)
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_members.id"), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    updated_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class Suggestion(Base):
    """2.6"""
    __tablename__ = "suggestions"
    __table_args__ = (
        CheckConstraint(_in("category", ("add", "remove", "change_time", "replace", "other")),
                        name="ck_suggestions_category"),
        CheckConstraint(_in("status", ("new", "converted", "noted", "declined")), name="ck_suggestions_status"),
        CheckConstraint("length(content) <= 1000", name="ck_suggestions_content_len"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_members.id"), nullable=False)
    day: Mapped[int | None] = mapped_column(Integer)
    item_id: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    based_on_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="new", server_default="new")
    leader_note: Mapped[str | None] = mapped_column(Text)
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("proposals.id"))
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    handled_at = mapped_column(UTCDateTime)


class AgentRun(Base):
    """2.9 — token lấy từ usage của API, không ước lượng."""
    __tablename__ = "agent_runs"
    __table_args__ = (
        CheckConstraint(_in("mode", ("generate", "draft", "ask")), name="ck_agent_runs_mode"),
        CheckConstraint(_in("status", ("ok", "error", "invalid_output", "rate_limited")), name="ck_agent_runs_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trips.id"))
    member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trip_members.id"))
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(Text)
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)
    tool_calls: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class ChatMessage(Base):
    """2.7 — hội thoại chung cả nhóm (OQ-14)."""
    __tablename__ = "chat_messages"
    __table_args__ = (
        CheckConstraint(_in("role", ("member", "agent")), name="ck_chat_messages_role"),
        Index("ix_chat_messages_trip_id", "trip_id", "id"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False)
    member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trip_members.id"))
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    plan_version: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("agent_runs.id"))
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class TripEvent(Base):
    """2.8 — ghi cùng transaction với thay đổi gây ra nó (I8)."""
    __tablename__ = "trip_events"
    __table_args__ = (
        CheckConstraint(_in("type", EVENT_TYPES), name="ck_trip_events_type"),
        Index("ix_trip_events_trip_id", "trip_id", "id"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trip_members.id"))
    payload = mapped_column(JSONType, nullable=False, default=dict, server_default=text("'{}'"))
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class PlacesCache(Base):
    """2.10 — response thô Geoapify; xoá được, chỉ tốn credit gọi lại."""
    __tablename__ = "places_cache"
    __table_args__ = (CheckConstraint(_in("kind", ("geocode", "search", "details", "route")),
                                      name="ck_places_cache_kind"),)

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    response = mapped_column(JSONType, nullable=False)
    fetched_at = mapped_column(UTCDateTime, nullable=False)
    expires_at = mapped_column(UTCDateTime)


class TrendingSpot(Base):
    """2.11 — kho quán hot thu trước (data/DATA_CARD.md). Không lưu thông tin người đăng."""
    __tablename__ = "trending_spots"
    __table_args__ = (CheckConstraint(_in("source", ("tiktok", "instagram")), name="ck_trending_spots_source"),)

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    city: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(Text)
    place_id: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    engagement = mapped_column(JSONType)
    summary: Mapped[str | None] = mapped_column(Text)
    collected_at = mapped_column(Date)


class User(Base):
    """2.14 — tài khoản đăng nhập bằng email và mật khẩu (seed từ EMAIL/PASSWORD trong .env)."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)


class AuthRefreshToken(Base):
    """2.15 — phiên refresh_token lưu băm SHA-256 cho cơ chế cookie auth."""
    __tablename__ = "auth_refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at = mapped_column(UTCDateTime, nullable=False)
    revoked_at = mapped_column(UTCDateTime)
    created_at = mapped_column(UTCDateTime, nullable=False, default=utcnow)

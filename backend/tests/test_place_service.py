from datetime import timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.db import base
from app.db.models import CityStore, Place, TripEvent
from app.errors import ApiError
from app.roa import tools
from app.services import place_service as ps
from app.services import trip_service as ts
from tests.conftest import FakeGeo


def body(dest="Quy Nhơn"):
    from datetime import date
    return SimpleNamespace(title="Quy Nhơn 2N1Đ", destination=dest, start_date=date(2026, 12, 5),
                           end_date=date(2026, 12, 6), group_size=4, budget_per_person=2_000_000,
                           preferences={}, leader_name="Đức")


def collect(settings, geo, mode="collect", slug="quy-nhon"):
    ps.run_collection(slug, mode, base.session_factory(), lambda db: geo, settings)


def test_new_city_collects_then_ready(db_session, settings):
    geo = FakeGeo()
    trip, member, token, store, job = ts.create_trip(db_session, body(), geo, settings)
    assert (store.city_slug, store.status, job) == ("quy-nhon", "collecting", "collect")
    assert trip.generation_status == "collecting_data" and member.role == "leader" and token
    collect(settings, geo)
    db_session.expire_all()
    store = db_session.get(CityStore, "quy-nhon")
    assert store.status == "ready" and store.place_count == 6 and store.expires_at is None  # OQ-12 chưa chốt
    assert db_session.get(type(trip), trip.id).generation_status == "idle"
    ev = db_session.scalars(select(TripEvent)).one()
    assert ev.type == "store_ready" and ev.payload == {"city_slug": "quy-nhon", "place_count": 6}
    # Chuyến đi thứ hai cùng thành phố: dùng kho sẵn, không gọi Geoapify.
    geo2 = FakeGeo()
    trip2, *_, job2 = ts.create_trip(db_session, body("Quy Nhơn"), geo2, settings)
    assert job2 is None and trip2.generation_status == "idle" and geo2.calls == []


def test_unknown_destination_and_geoapify_down(db_session, settings):
    with pytest.raises(ApiError) as e:
        ps.ensure_store(db_session, "Atlantis", FakeGeo(), settings)
    assert e.value.status == 422 and e.value.code == "unknown_destination"
    with pytest.raises(ApiError) as e:
        ps.ensure_store(db_session, "Quy Nhơn", FakeGeo(fail=True), settings)
    assert e.value.status == 503 and e.value.code == "places_unavailable"
    assert db_session.get(CityStore, "quy-nhon") is None


def test_failed_collection_then_retry(db_session, settings):
    trip, member, _, _, _ = ts.create_trip(db_session, body(), FakeGeo(), settings)
    collect(settings, FakeGeo(empty=True))
    db_session.expire_all()
    store = db_session.get(CityStore, "quy-nhon")
    assert store.status == "failed" and "không trả địa điểm" in store.error
    assert db_session.get(type(trip), trip.id).generation_status == "idle"
    assert db_session.scalars(select(TripEvent)).one().type == "store_failed"
    status, store, job = ts.retry_store(db_session, trip, member, settings)
    assert (status, store.status, job, trip.generation_status) == (202, "collecting", "collect", "collecting_data")
    with pytest.raises(ApiError) as e:  # đang thu → 409
        ts.retry_store(db_session, trip, member, settings)
    assert e.value.code == "data_collecting"
    collect(settings, FakeGeo())
    db_session.expire_all()
    status, store, job = ts.retry_store(db_session, trip, member, settings)
    assert (status, store.status, job) == (200, "ready", None)


def test_only_one_claim_and_stuck_job_reclaimed(db_session, settings):
    ts.create_trip(db_session, body(), FakeGeo(), settings)  # kho đang collecting
    now = base.utcnow()
    assert not ps.claim_collection(db_session, "quy-nhon", settings, now)
    db_session.rollback()
    store = db_session.get(CityStore, "quy-nhon")
    store.started_at = now - timedelta(minutes=settings.store_stuck_minutes + 1)
    db_session.commit()
    assert ps.claim_collection(db_session, "quy-nhon", settings, now)
    db_session.commit()
    assert not ps.claim_collection(db_session, "quy-nhon", settings, now)


def test_expired_store_refreshes_in_background_keeping_old_rows(db_session, settings):
    settings.store_ttl_days = 7
    ts.create_trip(db_session, body(), FakeGeo(), settings)
    collect(settings, FakeGeo())
    db_session.expire_all()
    store = db_session.get(CityStore, "quy-nhon")
    store.expires_at = base.utcnow() - timedelta(days=1)
    db_session.commit()
    store, job = ps.ensure_store(db_session, "Quy Nhơn", FakeGeo(), settings)
    assert (store.status, job) == ("ready", "refresh")
    assert ps.ensure_store(db_session, "Quy Nhơn", FakeGeo(), settings)[1] is None  # đã có job làm mới
    collect(settings, FakeGeo(fail=True), mode="refresh")  # làm mới lỗi: giữ kho cũ
    db_session.expire_all()
    store = db_session.get(CityStore, "quy-nhon")
    assert store.status == "ready" and store.error and store.place_count == 6
    assert len(db_session.scalars(select(Place)).all()) == 6


def test_list_places_filters_and_rows_for_agent(db_session, settings):
    ts.create_trip(db_session, body(), FakeGeo(), settings)
    collect(settings, FakeGeo())
    db_session.expire_all()
    assert {p.category for p in ps.list_places(db_session, "quy-nhon", category="cafe")} == {"cafe"}
    assert [p.name for p in ps.list_places(db_session, "quy-nhon", geo_category="catering.cafe")] == [
        "Cà phê Sóng", "Cafe Không Giờ"]
    assert len(ps.list_places(db_session, "quy-nhon", geo_category="tourism")) == 2
    assert ps.list_places(db_session, "quy-nhon", geo_category="catering.caf") == []  # tiền tố theo mã, không theo chữ
    d = ps.place_dict(ps.list_places(db_session, "quy-nhon", category="cafe")[0])
    assert d["open"] == "07:00" and d["close"] == "22:00" and d["price_unverified"]
    rows = ps.rows_for_agent(db_session, db_session.get(CityStore, "quy-nhon"))
    with tools.use_store(rows):
        assert tools.supported_cities() == ["Quy Nhơn"]
        cafes = tools.search_places("Quy Nhơn", category="cafe")
        assert {c["id"] for c in cafes} == {"osm:n1", "osm:n2"}
        assert any(c["hours_unverified"] for c in cafes)


def test_retry_requires_leader(db_session, settings):
    from app.db.models import TripMember
    trip, *_ = ts.create_trip(db_session, body(), FakeGeo(), settings)
    m = TripMember(trip_id=trip.id, display_name="Phúc", role="member", token_hash=ts.hash_token("x"),
                   joined_at=base.utcnow())
    db_session.add(m)
    db_session.commit()
    with pytest.raises(ApiError) as e:
        ts.retry_store(db_session, trip, m, settings)
    assert e.value.status == 403 and e.value.code == "not_leader"

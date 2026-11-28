"""Kho địa điểm theo thành phố: `city_stores`, `places`, `places_cache` (docs/DATABASE.md 2.10, 2.12, 2.13, mục 5).

Service khác đọc kho qua đây (R-12). Roa nhận kho qua `rows_for_agent()` + `codebase/tools.use_store()`,
không gọi Geoapify lúc `generate` (OQ-22).
"""
import json
import logging
from datetime import timedelta

from sqlalchemy import delete, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.db.base import utcnow
from app.db.models import CityStore, Place, TrendingSpot, Trip, TripEvent
from app.errors import ApiError
from app.roa import ROOT, city_key, hhmm
from app.services import place_cleaning as pc
from app.services.geoapify import GeoapifyError

log = logging.getLogger("partaway.places")
TRENDING_FILE = ROOT / "data" / "trending_spots.json"


class CollectError(Exception):
    """Đợt thu không ra kho dùng được (thông báo hiện cho nhóm trưởng)."""


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def store_dict(s: CityStore) -> dict:
    return {"city_slug": s.city_slug, "city_name": s.city_name, "status": s.status, "place_count": s.place_count,
            "fetched_at": _iso(s.fetched_at), "expires_at": _iso(s.expires_at), "error": s.error}


def place_dict(p: Place) -> dict:
    has = p.open_min is not None and p.close_min is not None
    return {"ref": p.ref, "name": p.name, "category": p.category, "geo_category": p.geo_category,
            "geo_categories": p.geo_categories or [], "area": p.area, "address": p.address, "lat": p.lat,
            "lon": p.lon, "open": hhmm(p.open_min) if has else None, "close": hhmm(p.close_min) if has else None,
            "opening_hours_raw": p.opening_hours_raw, "hours_unverified": p.hours_unverified,
            "avg_price_vnd": p.avg_price_vnd, "price_unverified": p.price_unverified, "is_hot": p.is_hot,
            "website": p.website, "rank": p.rank, "source": p.source}


def get_store(db, city_slug: str) -> CityStore | None:
    return db.get(CityStore, city_slug)


def _stuck_before(settings, now):
    return now - timedelta(minutes=settings.store_stuck_minutes)


def claim_collection(db, city_slug: str, settings, now) -> bool:
    """Chuyển kho sang `collecting`. Chỉ một tiến trình đổi được dòng (mục 5.1); job treo được nhận lại."""
    res = db.execute(update(CityStore)
                     .where(CityStore.city_slug == city_slug,
                            or_(CityStore.status != "collecting", CityStore.started_at.is_(None),
                                CityStore.started_at < _stuck_before(settings, now)))
                     .values(status="collecting", started_at=now, error=None)
                     .execution_options(synchronize_session=False))
    return res.rowcount == 1


def claim_refresh(db, city_slug: str, settings, now) -> bool:
    """Kho `ready` quá hạn: giữ `ready` (vẫn dùng kho cũ), chỉ đặt `started_at` làm khoá thu lại ở nền."""
    res = db.execute(update(CityStore)
                     .where(CityStore.city_slug == city_slug, CityStore.status == "ready",
                            CityStore.expires_at.is_not(None), CityStore.expires_at <= now,
                            or_(CityStore.started_at.is_(None), CityStore.started_at <= CityStore.fetched_at,
                                CityStore.started_at < _stuck_before(settings, now)))
                     .values(started_at=now)
                     .execution_options(synchronize_session=False))
    return res.rowcount == 1


def ensure_store(db, destination: str, geo, settings) -> tuple[CityStore, str | None]:
    """Kho cho điểm đến. Trả (kho, việc cần chạy ở nền: "collect" | "refresh" | None). Đã commit."""
    now = utcnow()
    slug = city_key(destination)
    if not slug:
        raise ApiError(422, "unknown_destination", "Điểm đến trống hoặc không đọc được.")
    store = db.get(CityStore, slug)
    if store is None:
        try:
            found = geo.geocode_city(destination.strip())
        except GeoapifyError:
            raise ApiError(503, "places_unavailable", "Chưa tra được điểm đến lúc này, thử lại sau.") from None
        if not found or not found.get("place_id"):
            raise ApiError(422, "unknown_destination", f"Không tìm thấy \"{destination.strip()}\" ở Việt Nam.",
                           {"destination": destination})
        alt = city_key(found.get("name") or "")
        store = db.get(CityStore, alt) if alt and alt != slug else None
        if store is None:
            name = found["name"] if found.get("name") and alt == slug else destination.strip()
            store = CityStore(city_slug=slug, city_name=name, geo_place_id=found["place_id"], lat=found.get("lat"),
                              lon=found.get("lon"), status="collecting", started_at=now, place_count=0)
            db.add(store)
            try:
                db.commit()
                return store, "collect"
            except IntegrityError:  # tiến trình khác vừa tạo cùng thành phố
                db.rollback()
                store = db.get(CityStore, slug)
    if store.status in ("failed", "collecting"):
        job = "collect" if claim_collection(db, store.city_slug, settings, now) else None
    elif claim_refresh(db, store.city_slug, settings, now):
        job = "refresh"
    else:
        job = None
    db.commit()
    db.refresh(store)
    return store, job


def hot_names(db, store: CityStore) -> list[str]:
    """Tên quán hot của thành phố: bảng `trending_spots` và kho file đã commit `data/trending_spots.json`."""
    names = [t.name for t in db.scalars(select(TrendingSpot)) if city_key(t.city) == store.city_slug]
    try:
        rows = json.loads(TRENDING_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        rows = []
    names += [r["name"] for r in rows if r.get("name") and city_key(r.get("city", "")) == store.city_slug]
    return list(dict.fromkeys(names))


def _finish_trips(db, city_slug: str, event: str, payload: dict) -> None:
    """Chuyến đi đang chờ kho → `idle`, ghi sự kiện cùng transaction (I8)."""
    for trip in db.scalars(select(Trip).where(Trip.city_slug == city_slug,
                                              Trip.generation_status == "collecting_data")):
        trip.generation_status = "idle"
        db.add(TripEvent(trip_id=trip.id, type=event, payload=payload))


def collect_groups(geo, store: CityStore, settings) -> dict:
    groups = {}
    for group, cats in pc.GROUPS.items():
        rows = []
        for page in range(settings.store_max_pages):
            feats = geo.places(cats, store.geo_place_id, store.lat, store.lon, settings.store_page_size,
                               page * settings.store_page_size)
            rows += [pc.slim(f) for f in feats]
            if len(feats) < settings.store_page_size:
                break
        groups[group] = rows
    return groups


def run_collection(city_slug: str, mode: str, make_session, geo_factory, settings) -> None:
    """Job nền của một đợt thu (mục 5.1). mode "collect": kho mới hoặc thu lại sau lỗi; "refresh": kho quá hạn."""
    db = make_session()
    try:
        store = db.get(CityStore, city_slug)
        geo = geo_factory(db)
        if not store.geo_place_id:
            found = geo.geocode_city(store.city_name)
            if not found or not found.get("place_id"):
                raise CollectError("Không tìm thấy thành phố trên Geoapify.")
            store.geo_place_id, store.lat, store.lon = found["place_id"], found.get("lat"), found.get("lon")
        groups = collect_groups(geo, store, settings)
        now = utcnow()
        center = (store.lat, store.lon) if store.lat is not None and store.lon is not None else None
        rows = pc.select_places(groups, center, hot_names(db, store), settings.store_max_cafe,
                                settings.store_max_food, now)
        if not rows:
            raise CollectError("Geoapify không trả địa điểm nào dùng được cho thành phố này.")
        # Thay toàn bộ kho của thành phố trong một transaction; `ref` ổn định nên plan cũ vẫn trỏ đúng.
        db.execute(delete(Place).where(Place.city_slug == city_slug))
        db.add_all(Place(city_slug=city_slug, **r) for r in rows)
        store.status, store.place_count, store.fetched_at, store.error = "ready", len(rows), now, None
        store.expires_at = now + timedelta(days=settings.store_ttl_days) if settings.store_ttl_days else None
        _finish_trips(db, city_slug, "store_ready", {"city_slug": city_slug, "place_count": len(rows)})
        db.commit()
        log.info("store ready city=%s places=%d mode=%s", city_slug, len(rows), mode)
    except Exception as e:  # noqa: BLE001 — job nền: mọi lỗi phải về trạng thái failed, không treo collecting
        db.rollback()
        known = isinstance(e, (GeoapifyError, CollectError))
        msg = str(e) if known else f"Lỗi khi thu kho ({type(e).__name__})."
        if not known:
            log.exception("store collection crashed city=%s", city_slug)
        store = db.get(CityStore, city_slug)
        if store is not None:
            store.error = msg[:500]
            if mode == "collect":
                store.status = "failed"
                _finish_trips(db, city_slug, "store_failed", {"city_slug": city_slug, "error": store.error})
            db.commit()
        log.warning("store failed city=%s mode=%s: %s", city_slug, mode, msg)
    finally:
        db.close()


def list_places(db, city_slug: str, category: str | None = None, geo_category: str | None = None,
                limit: int = 50) -> list[Place]:
    q = select(Place).where(Place.city_slug == city_slug)
    if category:
        q = q.where(Place.category == category)
    if geo_category:
        q = q.where(or_(Place.geo_category == geo_category, Place.geo_category.like(geo_category + ".%")))
    return list(db.scalars(q.order_by(Place.category, Place.rank).limit(limit)))


def rows_for_agent(db, store: CityStore) -> list[dict]:
    """Dòng kho theo dạng `codebase/tools.use_store()` nhận; `id` của Roa là `ref`."""
    return [{"id": p.ref, "name": p.name, "city": store.city_name, "category": p.category, "area": p.area,
             "lat": p.lat, "lon": p.lon, "address": p.address, "open_min": p.open_min, "close_min": p.close_min,
             "avg_price_vnd": p.avg_price_vnd, "vegetarian_friendly": p.vegetarian_friendly, "is_hot": p.is_hot,
             "source": p.source, "hours_unverified": p.hours_unverified, "price_unverified": p.price_unverified}
            for p in db.scalars(select(Place).where(Place.city_slug == store.city_slug)
                                .order_by(Place.category, Place.rank))]

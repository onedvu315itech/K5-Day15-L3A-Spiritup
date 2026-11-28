"""Fixture chung: SQLite tạm (create_all), nguồn Geoapify giả, settings riêng cho test."""
import pytest

from app.config import Settings
from app.db import base
from app.db import models  # noqa: F401
from app.services.geoapify import GeoapifyError


def feature(osm_id, name, cats, lat=13.77, lon=109.22, hours=None, website=None, addr=None, raw_extra=None):
    raw = {"osm_type": "n", "osm_id": osm_id, **(raw_extra or {})}
    return {"properties": {"place_id": f"p{osm_id}", "name": name, "categories": cats, "lat": lat, "lon": lon,
                           "formatted": addr or f"{name}, Phường Quy Nhơn, Gia Lai, Việt Nam",
                           "opening_hours": hours, "website": website, "datasource": {"raw": raw}}}


QUY_NHON = {
    "catering.cafe": [
        feature(1, "Cà phê Sóng", ["catering", "catering.cafe"], hours="07:00-22:00"),
        feature(2, "Cafe Không Giờ", ["catering", "catering.cafe", "catering.cafe.coffee_shop"]),
        feature(3, "Quán đã đóng", ["catering.cafe"], raw_extra={"disused:amenity": "cafe"}),
        feature(4, None, ["catering.cafe"]),
    ],
    "catering.restaurant,catering.fast_food": [
        feature(10, "Bún chả cá Bà Hai", ["catering.restaurant", "catering.restaurant.vietnamese"],
                hours="Mo-Su 06:00-21:00"),
        feature(11, "Cơm chay An Lạc", ["catering.restaurant"], hours="10:00-20:00"),
        feature(1, "Cà phê Sóng", ["catering.cafe"]),  # trùng OSM với nhóm cafe → bỏ
    ],
    "tourism.sights,tourism.attraction,entertainment": [
        feature(20, "Tháp Đôi", ["tourism.sights", "tourism.sights.tower"], hours="07:00-17:00"),
        feature(21, "Eo Gió", ["tourism.attraction", "tourism.attraction.viewpoint"]),
    ],
    "accommodation.hotel,accommodation.guest_house,accommodation.hostel,accommodation.motel": [
        feature(30, "Khách sạn Hải Âu", ["accommodation", "accommodation.hotel"], lat=13.771),
        feature(31, "Nhà nghỉ Gió Biển", ["accommodation", "accommodation.guest_house"], lat=13.78),
    ],
}
STORE_SIZE = 8  # số nơi kho Quy Nhơn giả giữ lại sau khi lọc


class FakePrice:
    """Nguồn giá phòng giả, cùng hàm như TavilyPriceSource."""

    def __init__(self, prices=None):
        self.prices = prices if prices is not None else {
            "Khách sạn Hải Âu": {"price_min_vnd": 600000, "price_max_vnd": 900000,
                                 "price_source_url": "https://example.test/hai-au"}}
        self.calls = []

    def room_price(self, name, city):
        self.calls.append((name, city))
        return self.prices.get(name)


class FakeGeo:
    """Cùng hai hàm như GeoapifySource. `fail` = ném GeoapifyError; `empty` = Places không trả gì."""

    def __init__(self, cities=None, fail=False, empty=False):
        self.cities = cities if cities is not None else {
            "quy nhơn": {"place_id": "qn", "name": "Quy Nhơn", "lat": 13.77, "lon": 109.22}}
        self.fail, self.empty, self.calls = fail, empty, []

    def geocode_city(self, text):
        self.calls.append(("geocode", text))
        if self.fail:
            raise GeoapifyError("Geoapify HTTP 503: giả")
        return self.cities.get(text.strip().lower())

    def places(self, categories, place_id, lat, lon, limit, offset):
        self.calls.append(("places", categories, offset))
        if self.fail:
            raise GeoapifyError("Geoapify HTTP 503: giả")
        return [] if self.empty or offset else QUY_NHON.get(categories, [])


@pytest.fixture
def settings(tmp_path):
    return Settings(database_url=f"sqlite:///{(tmp_path / 't.db').as_posix()}", geoapify_api_key="",
                    frontend_base_url="http://fe.test", store_ttl_days=None, tavily_api_key="")


@pytest.fixture
def db_session(settings):
    engine = base.init_engine(settings.database_url)
    base.Base.metadata.create_all(engine)
    s = base.session_factory()()
    yield s
    s.close()
    engine.dispose()

"""Giá phòng: đọc số tiền từ đoạn văn Tavily và điền giá trong đợt thu kho (không gọi mạng)."""
from sqlalchemy import select

from app.db import base
from app.db.models import CityStore, Place
from app.services import place_service as ps
from app.services.tavily import TavilyError, TavilyPriceSource, parse_prices
from tests.conftest import STORE_SIZE, FakeGeo, FakePrice


def test_parse_prices_units():
    text = "Phòng đôi 450.000đ, suite 1,2 triệu/đêm, combo 650k, mã 2026, 3 sao, 1.500.000 VND"
    assert parse_prices(text) == [450_000, 1_200_000, 650_000, 1_500_000]
    assert parse_prices("Giá 50k gửi xe, 99 triệu căn hộ") == []  # ngoài khoảng giá phòng/đêm
    assert parse_prices("") == []


class FakeClient:
    def __init__(self, results=None, fail=False):
        self.results, self.fail = results or [], fail

    def search(self, query, max_results=5):
        if self.fail:
            raise TavilyError("Tavily HTTP 429")
        return self.results


def test_room_price_takes_first_page_with_prices():
    src = TavilyPriceSource(FakeClient([
        {"title": "Review", "content": "đẹp, gần biển", "url": "https://a.test"},
        {"title": "Giá phòng", "content": "từ 500.000đ đến 900.000đ", "url": "https://b.test"},
        {"title": "Khác", "content": "2 triệu", "url": "https://c.test"}]))
    assert src.room_price("Khách sạn Hải Âu", "Quy Nhơn") == {
        "price_min_vnd": 500_000, "price_max_vnd": 900_000, "price_source_url": "https://b.test"}
    assert TavilyPriceSource(FakeClient([{"content": "đẹp", "url": "https://a.test"}])).room_price("X", "Y") is None


def test_price_lodging_skips_on_error():
    rows = [{"category": "lodging", "name": "A"}, {"category": "cafe", "name": "B"}]
    assert ps.price_lodging(rows, "Quy Nhơn", None, 10) == 0
    assert ps.price_lodging(rows, "Quy Nhơn", TavilyPriceSource(FakeClient(fail=True)), 10) == 0
    assert "price_min_vnd" not in rows[0]


def test_collection_stores_lodging_with_price(db_session, settings):
    db_session.add(CityStore(city_slug="quy-nhon", city_name="Quy Nhơn", geo_place_id="qn", lat=13.77,
                             lon=109.22, status="collecting", place_count=0))
    db_session.commit()
    price = FakePrice()
    ps.run_collection("quy-nhon", "collect", base.session_factory(), lambda db: FakeGeo(), settings, price)
    db_session.expire_all()
    assert db_session.get(CityStore, "quy-nhon").place_count == STORE_SIZE
    lodging = {p.name: p for p in db_session.scalars(select(Place).where(Place.category == "lodging"))}
    assert set(lodging) == {"Khách sạn Hải Âu", "Nhà nghỉ Gió Biển"}
    hai_au = lodging["Khách sạn Hải Âu"]
    assert (hai_au.price_min_vnd, hai_au.price_max_vnd) == (600_000, 900_000)
    assert hai_au.price_source_url == "https://example.test/hai-au"
    assert lodging["Nhà nghỉ Gió Biển"].price_min_vnd is None
    assert {c[0] for c in price.calls} == set(lodging)

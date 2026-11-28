from datetime import datetime, timezone

from app.services import place_cleaning as pc
from tests.conftest import QUY_NHON

NOW = datetime(2026, 11, 28, tzinfo=timezone.utc)


def groups():
    return {g: [pc.slim(f) for f in QUY_NHON[c]] for g, c in pc.GROUPS.items()}


def test_parse_hours():
    assert pc.parse_hours("Mo-Su 07:00-22:00") == (420, 1320)
    assert pc.parse_hours("18:00-02:00") == (1080, 1560)
    assert pc.parse_hours("24/7") == (0, 1440)
    assert pc.parse_hours("Mo-Fr 08:00-17:00; Sa 08:00-12:00") is None
    assert pc.parse_hours(None) is None


def test_geo_category_picks_most_specific():
    assert pc.geo_category(["catering", "catering.cafe", "catering.cafe.coffee_shop"]) == "catering.cafe.coffee_shop"
    assert pc.geo_category([]) is None


def test_select_keeps_unverified_drops_closed_and_dupes():
    rows = pc.select_places(groups(), (13.77, 109.22), [], 60, 60, NOW)
    names = [r["name"] for r in rows]
    assert "Quán đã đóng" not in names and None not in names
    assert names.count("Cà phê Sóng") == 1
    no_hours = next(r for r in rows if r["name"] == "Cafe Không Giờ")
    assert no_hours["hours_unverified"] and no_hours["open_min"] is None
    assert all(r["price_unverified"] and r["avg_price_vnd"] is None for r in rows)
    assert no_hours["geo_category"] == "catering.cafe.coffee_shop"
    assert no_hours["ref"] == "osm:n2" and no_hours["area"] == "Phường Quy Nhơn"
    chay = next(r for r in rows if r["name"] == "Cơm chay An Lạc")
    assert chay["vegetarian_friendly"] is True


def test_ranking_hot_then_hours_and_caps():
    rows = pc.select_places(groups(), (13.77, 109.22), ["Không Giờ"], 60, 60, NOW)
    cafes = [r for r in rows if r["category"] == "cafe"]
    assert [r["name"] for r in cafes] == ["Cafe Không Giờ", "Cà phê Sóng"]  # quán hot lên trước dù thiếu giờ
    assert [r["rank"] for r in cafes] == [1, 2] and cafes[0]["is_hot"]
    rows = pc.select_places(groups(), (13.77, 109.22), [], 1, 1, NOW)
    assert sum(r["category"] == "cafe" for r in rows) == 1
    assert sum(r["category"] == "food" for r in rows) == 1
    assert sum(r["category"] == "sightseeing" for r in rows) == 2  # điểm tham quan không giới hạn
    assert next(r for r in rows if r["category"] == "cafe")["name"] == "Cà phê Sóng"  # có giờ trước

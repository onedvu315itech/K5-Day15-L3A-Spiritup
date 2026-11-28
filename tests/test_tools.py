"""Kiểm hợp đồng công cụ Roa với kho JSON đã commit (không gọi mạng)."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "codebase"))
import tools
from tracing import TOOLS


class RoaToolsTest(unittest.TestCase):
    def test_tool_registration(self):
        names = {"search_places", "get_trending_spots", "get_opening_hours", "get_travel_time",
                 "analyze_plan_gaps", "search_nearby", "check_itinerary"}
        self.assertTrue(names <= set(TOOLS))

    def test_supported_cities_and_aliases(self):
        cities = tools.supported_cities()
        for c in ("Đà Lạt", "Hà Nội", "Đà Nẵng", "TP.HCM", "Huế"):
            self.assertIn(c, cities)
        self.assertEqual(tools.city_name("Sài Gòn"), "TP.HCM")
        self.assertEqual(tools.city_name("ha noi"), "Hà Nội")
        self.assertIsNone(tools.city_name("Nha Trang"))
        self.assertEqual(tools.search_places("Nha Trang"), [])

    def test_search_places_filters(self):
        snacks = tools.search_places("Ha Noi", category="snack")
        self.assertTrue(snacks)
        self.assertTrue(all(p["category"] == "snack" for p in snacks))
        veg = tools.search_places("Huế", "chay")
        self.assertTrue(veg)
        self.assertTrue(all(p.get("vegetarian_friendly") for p in veg))

    def test_trending_keeps_unmatched_records_without_id(self):
        spots = tools.get_trending_spots("Đà Lạt")
        self.assertTrue(any(s["id"] is None for s in spots))
        self.assertTrue(any(s["id"] == "DL-15" for s in spots))

    def test_opening_hours_missing_is_none(self):
        hours = tools.get_opening_hours(["HN-01", "DL-15", "lạ"])
        self.assertEqual(hours["HN-01"]["open"], "06:00")
        self.assertIsNone(hours["DL-15"]["open"])
        self.assertNotIn("lạ", hours)  # mã lạ bị bỏ qua

    def test_travel_time_same_area_and_unknown(self):
        self.assertGreaterEqual(tools.get_travel_time("HN-01", "HN-11"), tools.SAME_AREA_MIN)
        self.assertEqual(tools.get_travel_time("HN-01", "khong-co"), tools.DEFAULT_MIN)

    def test_gaps_boundaries(self):
        for free, kind in [(44, "short"), (45, "medium"), (90, "medium"), (91, "long")]:
            with self.subTest(free=free):
                end_b = 9 * 60 + 10 + free  # HN-01 → HN-06 cùng khu nên đi 10 phút
                items = [{"day": 1, "id": "HN-06", "start": tools.hhmm(end_b), "end": tools.hhmm(end_b + 60)},
                         {"day": 1, "id": "HN-01", "start": "08:00", "end": "09:00"}]
                travel = tools.get_travel_time("HN-01", "HN-06")
                items[0]["start"] = tools.hhmm(9 * 60 + travel + free)
                gap, = tools.analyze_plan_gaps(items)
                self.assertEqual((gap["from_id"], gap["to_id"], gap["gap_min"], gap["kind"]),
                                 ("HN-01", "HN-06", free, kind))
                self.assertEqual(bool(gap["categories"]), free >= 45)

    def test_search_nearby_sorted_and_limited(self):
        rows = tools.search_nearby("HN-01", ["snack", "cafe"], 15)
        self.assertTrue(rows)
        self.assertTrue(all(r["id"] != "HN-01" and r["category"] in {"snack", "cafe"} for r in rows))
        minutes = [r["travel_min"] for r in rows]
        self.assertEqual(minutes, sorted(minutes))
        self.assertTrue(all(m <= 15 for m in minutes))
        self.assertTrue(all(r["id"].startswith("HN-") for r in rows))

    def test_check_itinerary_budget_hours_overlap_and_missing(self):
        ok = [{"day": 1, "id": "HN-01", "start": "08:00", "end": "09:00"},
              {"day": 1, "id": "HN-11", "start": "09:30", "end": "11:00"}]
        res = tools.check_itinerary(ok, 200000)
        self.assertTrue(res["valid"], res["violations"])
        self.assertEqual(res["total_per_person_vnd"], 65000 + 50000)
        self.assertFalse(tools.check_itinerary(ok, 100000)["valid"])
        closed = [{"day": 1, "id": "HN-11", "start": "06:00", "end": "07:00"}]
        self.assertFalse(tools.check_itinerary(closed, 0)["valid"])
        overlap = [ok[0], {"day": 1, "id": "HN-05", "start": "08:30", "end": "09:30"}]
        self.assertFalse(tools.check_itinerary(overlap, 0)["valid"])
        missing = tools.check_itinerary([{"day": 1, "id": "DL-15", "start": "09:00", "end": "10:00"}], 0)
        self.assertTrue(missing["missing_data"])


if __name__ == "__main__":
    unittest.main()

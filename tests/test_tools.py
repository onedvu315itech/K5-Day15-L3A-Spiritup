"""Kiểm hợp đồng công cụ Roa với kho JSON thật và phản hồi HTTP mô phỏng."""
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "codebase"))
import tools


class RoaToolsTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.data = Path(tmp.name)
        for filename in ("places_vn.json", "trending_spots.json"):
            shutil.copyfile(tools.DATA / filename, self.data / filename)
        for p in (patch.object(tools, "DATA", self.data), patch.dict(os.environ, {}, clear=True),
                  patch.object(tools, "_google_places", {})):
            p.start()
            self.addCleanup(p.stop)
        request = patch.object(tools, "_request", side_effect=AssertionError("Gọi mạng ngoài dự kiến"))
        self.http = request.start()
        self.addCleanup(request.stop)

    def test_local_preferences_trending_and_hours(self):
        rows = tools.search_places("Ha Noi", "ăn vặt")
        self.assertTrue(rows)
        self.assertTrue(all(p["category"] == "snack" and p["city"] == "Hà Nội" for p in rows))
        self.assertTrue(tools.search_places("Hồ Chí Minh", "cà phê"))
        self.assertTrue(all(p["vegetarian_friendly"] for p in tools.search_places("Hue", "ăn chay")))
        self.assertEqual(tools.search_places("Hà Nội", "địa điểm không tồn tại"), [])
        self.assertEqual(tools.get_trending_spots("Huế"), [])
        self.assertIn("engagement", tools.get_trending_spots("Da Lat")[0])
        hours = tools.get_opening_hours(["DL-01", "DL-15", "lạ"])
        self.assertEqual(hours["DL-01"]["open_hour"], 7)
        self.assertIsNone(hours["DL-15"]["open_hour"])
        self.assertIsNone(hours["lạ"])
        self.http.assert_not_called()

    def test_offline_fallback_is_scoped_to_city(self):
        (self.data / "places_vn.json").unlink()
        self.assertEqual(len(tools.search_places("Đà Lạt")), len(tools.MOCK_PLACES))
        self.assertEqual(tools.search_places("Huế"), [])

    def test_coordinates_areas_and_unknown_location(self):
        self.assertEqual(tools.get_travel_time((0, 0), (0, 0.01)), 4)
        self.assertEqual(tools.get_travel_time((0, 0), (0, 0)), 0)
        self.assertEqual(tools.get_travel_time(area_a="Trại Mát", area_b="Trung tâm"), 25)
        self.assertIsNone(tools.get_travel_time({}, {}))

    def test_google_search_reuses_id_cache_and_restores_details(self):
        os.environ["GOOGLE_MAPS_API_KEY"] = "test"
        google = {"id": "abc", "displayName": {"text": "Cafe A"}, "types": ["cafe"],
                  "formattedAddress": "Phú Quốc, Việt Nam", "location": {"latitude": 10, "longitude": 104},
                  "regularOpeningHours": {"periods": [
                      {"open": {"day": d, "hour": 8}, "close": {"day": d, "hour": 18}} for d in range(7)]}}
        self.http.side_effect = [{"places": [google]}, google]
        rows = tools.search_places("Phú Quốc", "cafe")
        self.assertEqual(rows[0]["open_hour"], 8)
        self.assertEqual(tools.search_places("Phu Quoc", "cà phê"), rows)
        self.assertEqual(self.http.call_count, 1)
        self.assertNotIn("Cafe A", (self.data / "raw/cache_maps.json").read_text(encoding="utf8"))
        tools._google_places.clear()
        self.assertEqual(tools.search_places("Phú Quốc", "cafe"), rows)
        self.assertTrue(self.http.call_args.args[0].endswith("/abc"))
        self.assertEqual(tools.get_opening_hours(["abc"])["abc"]["close_hour"], 18)

    def test_vietmap_uses_disk_cache_offline(self):
        os.environ["VIETMAP_API_KEY"] = "test"
        self.http.side_effect = [[{"ref_id": "auto:1"}], {"name": "Cà phê A", "display": "Phú Quốc",
                                                         "lat": 10, "lng": 104}]
        rows = tools.search_places("Phú Quốc", "cafe")
        self.assertEqual(rows[0]["lon"], 104)
        del os.environ["VIETMAP_API_KEY"]
        self.assertEqual(tools.search_places("Phu Quoc", "cafe"), rows)
        self.assertIsNone(tools.get_opening_hours([rows[0]["id"]])[rows[0]["id"]]["open_hour"])
        self.assertEqual(self.http.call_count, 2)

    def test_lookup_cache_supplies_hours_and_price_to_itinerary(self):
        os.environ["TAVILY_API_KEY"] = "test"
        place = next(p for p in tools.search_places("Đà Lạt") if p["id"] == "DL-15")
        hit = {"url": "https://example.org/diem", "title": place["name"] + " Đà Lạt",
               "content": "Giờ mở cửa: 08:30–18:00. Giá vé 50.000 đồng/người."}
        self.http.side_effect = [{"results": [hit]}]
        details = tools.lookup_place_details(place["name"], "Đà Lạt")
        self.assertEqual((details["open_hour"], details["avg_price_vnd"]), (8.5, 50000))
        self.assertEqual(details["sources"]["opening_hours"], hit["url"])
        del os.environ["TAVILY_API_KEY"]
        self.assertEqual(tools.lookup_place_details(place["name"], "Da Lat"), details)
        self.assertEqual(tools.get_opening_hours(["DL-15"])["DL-15"]["open_hour"], 8.5)
        report = tools.check_itinerary([{"id": "DL-15", "start_hour": 8, "end_hour": 10}], 49000)
        self.assertEqual(report["total_per_person_vnd"], 50000)
        self.assertEqual(len(report["violations"]), 2)
        self.assertEqual(report["missing_data"], [])

    def test_lookup_unknown_ambiguous_and_transient_failure(self):
        os.environ["TAVILY_API_KEY"] = "test"
        self.http.side_effect = [TimeoutError(), {"results": [{"url": "https://example.org/a",
            "title": "Quán A Huế", "content": "Cuối tuần mở cửa 8h–10h. Giá từ 20–50k/người, 10k/món."}]}]
        for _ in range(3):
            self.assertIsNone(tools.lookup_place_details("Quán A", "Huế"))
        self.assertEqual(self.http.call_count, 2)

    def test_lookup_requires_unambiguous_per_person_price(self):
        os.environ["TAVILY_API_KEY"] = "test"
        hit = {"url": "https://example.org/gia", "title": "Quán A Huế",
               "content": "Mở cửa 7h–22h. Giá 20.000 đồng đến 50.000 đồng/người."}
        other = {**hit, "title": "Quán B Huế", "content": "Gần Quán A. Giá vé 30k/người."}
        self.http.side_effect = [{"results": [hit, other]}]
        result = tools.lookup_place_details("Quán A", "Huế")
        self.assertEqual(result["close_hour"], 22)
        self.assertIsNone(result["avg_price_vnd"])

    def test_tool_registration_and_unknown_travel(self):
        names = {"search_places", "get_trending_spots", "get_opening_hours", "get_travel_time",
                 "lookup_place_details", "analyze_plan_gaps", "search_nearby", "check_itinerary"}
        self.assertTrue(all(tools.TOOLS[name] is getattr(tools, name) for name in names))
        a = {"id": "a", "name": "A", "start_hour": 8, "end_hour": 9}
        b = {**a, "id": "b", "start_hour": 10, "end_hour": 11}
        gap, = tools.analyze_plan_gaps([b, a])
        self.assertIsNone(gap["gap_min"])
        self.assertEqual(gap["categories"], [])
        self.assertIn("travel_min", tools.check_itinerary([a, b], 1)["missing_data"][1]["fields"])

    def test_gaps_boundaries_travel_and_day_order(self):
        for free, kind in [(44, "short"), (45, "medium"), (90, "medium"), (91, "long")]:
            with self.subTest(free=free):
                items = [{"id": "b", "area": "A", "start_hour": 9 + (free + 10) / 60, "day": 1},
                         {"id": "c", "area": "A", "start_hour": 8, "day": 2},
                         {"id": "a", "area": "A", "start_hour": 8, "end_hour": 9, "day": 1}]
                original = json.dumps(items)
                gap, = tools.analyze_plan_gaps(items)
                self.assertEqual((gap["from_id"], gap["to_id"], gap["travel_min"], gap["gap_min"], gap["kind"]),
                                 ("a", "b", 10, free, kind))
                self.assertEqual(bool(gap["categories"]), free >= 45)
                self.assertEqual(json.dumps(items), original)

    def test_nearby_id_coords_and_time_limit(self):
        p = tools.search_places("Hà Nội", "snack")[0]
        results = tools.search_nearby(p["id"], "Ha Noi", ["snack", "cà phê"], 15)
        self.assertTrue(results)
        self.assertTrue(all(r["id"] != p["id"] and r["category"] in {"snack", "cafe"} for r in results))
        minutes = [r["travel_min"] for r in results]
        self.assertEqual(minutes, sorted(m for m in minutes if m <= 15))
        self.assertEqual(tools.search_nearby((p["lat"], p["lon"]), "Hà Nội", "snack cafe"), results)
        self.assertEqual(tools.search_nearby(p["id"], "Huế", "cafe"), [])
        self.assertEqual(tools.search_nearby((0, 0), "Hà Nội", "cafe"), [])

    def test_partial_budget_travel_overlap_and_separate_days(self):
        known = {"id": "DL-01", "day": 1, "start_hour": 8, "end_hour": 9}
        unknown = {"id": "item", "place_id": "DL-15", "day": 1, "start_hour": 9, "end_hour": 10}
        free = {"id": "DL-06", "day": 2, "start_hour": 8, "end_hour": 9}
        report = tools.check_itinerary([free, unknown, known], 65000)
        self.assertEqual(report["total_per_person_vnd"], 65000)
        self.assertEqual(report["missing_data"][0]["id"], "item")
        self.assertEqual(set(report["missing_data"][0]["fields"]), set(tools.DETAIL_FIELDS))
        self.assertEqual(len(report["violations"]), 1)
        self.assertIn("di chuyển", report["violations"][0])
        self.assertTrue(tools.check_itinerary([free, known], 65000)["valid"])
        unknown["start_hour"] = 8.5
        self.assertIn("chồng giờ", tools.check_itinerary([unknown, known], 65000)["violations"][0])

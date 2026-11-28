"""Kiểm tra luồng answer() khi có plan gốc chứa khoảng trống và hợp đồng token của Gemini."""
import json
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "codebase"))
import agent
import ai


class RoaAgentGapFillTest(unittest.TestCase):
    def test_answer_fills_gap_on_base_plan_with_tools(self):
        base_request = (
            "Plan gốc ngày 1 ở Hà Nội:\n"
            "- 08:00–09:00: Phở Bát Đàn (HN-01)\n"
            "- 10:30–12:00: Loading T Café (HN-06)\n"
            "Ngân sách tối đa 250.000đ/người. Hãy gợi ý lấp khoảng trống giữa 2 điểm trên."
        )
        prompts_seen = []

        def fake_call_model(system, user):
            prompts_seen.append(user)
            step = len(prompts_seen)
            if step == 1:
                payload = {
                    "action": "call_tools",
                    "mode": "fill_gaps",
                    "thought": "Phân tích khoảng trống của plan gốc tại Hà Nội",
                    "calls": [
                        {
                            "tool": "analyze_plan_gaps",
                            "args": {
                                "items": [
                                    {"id": "p1", "place_id": "HN-01", "day": 1, "start_hour": 8, "end_hour": 9},
                                    {"id": "p2", "place_id": "HN-06", "day": 1, "start_hour": 10.5, "end_hour": 12},
                                ]
                            },
                        }
                    ],
                }
            elif step == 2:
                self.assertIn("analyze_plan_gaps", user)
                self.assertIn('"kind": "medium"', user)
                payload = {
                    "action": "call_tools",
                    "mode": "fill_gaps",
                    "thought": "Tìm quán cafe/snack gần HN-01 cho khoảng trống medium",
                    "calls": [
                        {
                            "tool": "search_nearby",
                            "args": {
                                "place_id_or_coords": "HN-01",
                                "city": "Hà Nội",
                                "categories": ["snack", "cafe"],
                                "max_travel_min": 15,
                            },
                        }
                    ],
                }
            elif step == 3:
                self.assertIn("search_nearby", user)
                payload = {
                    "action": "call_tools",
                    "mode": "fill_gaps",
                    "thought": "Kiểm tra lại lịch trình dự kiến sau khi chèn điểm lấp khoảng trống",
                    "calls": [
                        {
                            "tool": "check_itinerary",
                            "args": {
                                "items": [
                                    {"id": "p1", "place_id": "HN-01", "day": 1, "start_hour": 8, "end_hour": 9},
                                    {"id": "gap1", "place_id": "HN-05", "day": 1, "start_hour": 9.25, "end_hour": 10.0},
                                    {"id": "p2", "place_id": "HN-06", "day": 1, "start_hour": 10.5, "end_hour": 12},
                                ],
                                "budget_per_person_vnd": 250000,
                            },
                        }
                    ],
                }
            else:
                self.assertIn('"valid": true', user)
                payload = {
                    "action": "final",
                    "mode": "fill_gaps",
                    "thought": "Đề xuất nháp đã qua check_itinerary hợp lệ",
                    "answer": (
                        "Đề xuất nháp lấp khoảng trống 09:15–10:00: ghé Cà Phê Giảng (HN-05). "
                        "Nhóm trưởng vui lòng xem và duyệt trước khi áp dụng."
                    ),
                }
            return {"text": json.dumps(payload, ensure_ascii=False), "model": "mock", "tokens_in": 10, "tokens_out": 10}

        with patch.object(agent, "call_model", side_effect=fake_call_model):
            res = agent.answer(base_request)

        self.assertEqual(len(prompts_seen), 4)
        self.assertIn("Cà Phê Giảng", res["output"])
        self.assertIn("nhóm trưởng", res["output"].lower())

    def test_gemini_token_accounting_includes_thoughts(self):
        fake_resp = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "suy nghĩ nội bộ", "thought": True},
                            {"text": "Xin chào"},
                        ]
                    }
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 120,
                "candidatesTokenCount": 30,
                "thoughtsTokenCount": 45,
            },
        }
        with (
            patch.object(ai, "MODEL_PROVIDER", "gemini"),
            patch.object(ai, "MODEL_NAME", "gemini-2.5-flash"),
            patch.object(ai, "API_KEY", "dummy-key"),
            patch.object(ai, "post_json", return_value=fake_resp) as mocked_post,
        ):
            res = ai.call_model("sys", "hi")

        self.assertEqual(res["text"], "Xin chào")
        self.assertEqual(res["model"], "gemini-2.5-flash")
        self.assertEqual(res["tokens_in"], 120)
        self.assertEqual(res["tokens_out"], 75)
        self.assertIn("generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", mocked_post.call_args.args[0])

    def test_generate_rejects_final_after_failed_check_until_rechecked(self):
        prompts_seen = []

        def fake_call_model(system, user):
            prompts_seen.append(user)
            step = len(prompts_seen)
            if step == 1:
                payload = {
                    "action": "call_tools",
                    "mode": "generate",
                    "thought": "Kiểm tra lịch ban đầu bị vượt ngân sách",
                    "calls": [
                        {
                            "tool": "check_itinerary",
                            "args": {
                                "items": [
                                    {"id": "DL-02", "day": 1, "start_hour": 8, "end_hour": 9},
                                    {"id": "DL-01", "day": 1, "start_hour": 9.5, "end_hour": 11},
                                    {"id": "DL-03", "day": 1, "start_hour": 11.5, "end_hour": 13},
                                    {"id": "DL-12", "day": 1, "start_hour": 13.5, "end_hour": 15},
                                    {"id": "DL-10", "day": 1, "start_hour": 15.5, "end_hour": 16.5},
                                    {"id": "DL-08", "day": 1, "start_hour": 17, "end_hour": 18.5},
                                ],
                                "budget_per_person_vnd": 400000,
                            },
                        }
                    ],
                }
            elif step == 2:
                # Mô phỏng model cố trả final ngay dù check_itinerary trước đó valid=False
                payload = {
                    "action": "final",
                    "mode": "generate",
                    "thought": "Tự bớt Still Cafe mà chưa kiểm lại",
                    "answer": "Lịch trình nháp chưa kiểm lại.",
                }
            elif step == 3:
                self.assertIn("valid=False", user)
                payload = {
                    "action": "call_tools",
                    "mode": "generate",
                    "thought": "Kiểm lại danh sách 5 điểm sau khi bỏ DL-08",
                    "calls": [
                        {
                            "tool": "check_itinerary",
                            "args": {
                                "items": [
                                    {"id": "DL-02", "day": 1, "start_hour": 8, "end_hour": 9},
                                    {"id": "DL-01", "day": 1, "start_hour": 9.5, "end_hour": 11},
                                    {"id": "DL-03", "day": 1, "start_hour": 11.5, "end_hour": 13},
                                    {"id": "DL-12", "day": 1, "start_hour": 13.5, "end_hour": 15},
                                    {"id": "DL-10", "day": 1, "start_hour": 15.5, "end_hour": 16.5},
                                ],
                                "budget_per_person_vnd": 400000,
                            },
                        }
                    ],
                }
            else:
                self.assertIn('"valid": true', user)
                payload = {
                    "action": "final",
                    "mode": "generate",
                    "thought": "Đã kiểm lại hợp lệ 350.000đ/người",
                    "answer": "Lịch trình đã kiểm lại hợp lệ: 350.000đ/người.",
                }
            return {"text": json.dumps(payload, ensure_ascii=False), "model": "mock", "tokens_in": 10, "tokens_out": 10}

        with patch.object(agent, "call_model", side_effect=fake_call_model):
            res = agent.answer("Nhóm 6 người đi Đà Lạt 1 ngày, ngân sách 400.000đ/người.")

        self.assertEqual(len(prompts_seen), 4)
        self.assertIn("350.000đ/người", res["output"])

    def test_malformed_action_json_retries_instead_of_leaking_raw_json(self):
        prompts_seen = []

        def fake_call_model(system, user):
            prompts_seen.append(user)
            if len(prompts_seen) == 1:
                bad_json = '{"action": "call_tools", "mode": "generate", "calls": [{"tool": "search_places", "args": {"city": "Đà Lạt"}}}}]}'
                return {"text": bad_json, "model": "mock", "tokens_in": 10, "tokens_out": 10}
            good = {"action": "final", "mode": "ask_missing", "thought": "OK", "answer": "Vui lòng cho biết số ngày."}
            return {"text": json.dumps(good, ensure_ascii=False), "model": "mock", "tokens_in": 10, "tokens_out": 10}

        with patch.object(agent, "call_model", side_effect=fake_call_model):
            res = agent.answer("Lập lịch đi Đà Lạt.")

        self.assertEqual(len(prompts_seen), 2)
        self.assertIn("Vui lòng cho biết số ngày", res["output"])

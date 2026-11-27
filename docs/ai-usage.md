# Khai báo dùng AI

README của nhóm có mục "Dùng AI vào việc gì" (2–3 dòng, bắt buộc). Ghi chi tiết vào bảng dưới đây.

> Luật của đề: dùng AI để làm bài thoải mái, nhưng **ai không giải thích được phần có tên mình thì phần đó nhận 0 điểm**. Khai thiếu không bị trừ; giấu mới bị.

| Việc | Công cụ AI | AI làm gì | Người kiểm/sửa gì | Ai phụ trách |
|---|---|---|---|---|
| Code bản chạy thử | Coding agent (Antigravity) | Nối Gemini REST API trong `codebase/ai.py`, viết vòng lặp agent 5 bước dùng 8 công cụ trong `codebase/agent.py`, thêm test trong `tests/test_agent.py` | Chạy `unittest discover -s tests -v` (chưa chạy eval đầy đủ do quota 429) | Toàn *(chờ xác nhận)* |
| Prompt / thiết kế lời gọi mô hình | Coding agent (Antigravity) | Soạn `SYSTEM`, `ORCHESTRATOR_GUIDE` và chốt kiểm tra bắt buộc `analyze_plan_gaps` / `check_itinerary` (không cho kết thúc khi `valid=False`) | Đối chiếu trace `B01` trong `traces/run-try.jsonl` và dữ liệu `data/places_vn.json` | Toàn *(chờ xác nhận)* |
| Đào data (viết script đếm, gợi ý nhãn) | | | Kiểm tay __ dòng, khớp __ | |
| Rà câu hỏi phỏng vấn / khảo sát | | Chỉ rà câu dẫn dắt | | |
| Viết câu thử (benchmark) | Coding agent (Antigravity) | Soạn thêm 12 câu (`B13`–`B24`) mở rộng `eval/benchmark.csv` lên 24 câu dựa trên phiếu `evidence/survey/results.csv` và `data/` | Chạy `python run.py check`; chờ Đức/Toàn rà tay lại từng câu mới | Toàn / Đức *(chờ xác nhận)* |
| Sinh data `synthetic` (nếu có) | | | Seed __ · kiểm tay __ dòng | |
| Chấm cột `pass` bằng LLM (nếu có) | | | Kiểm tra thủ công __ câu thử, khớp __/__ | |
| Slide, văn bản | | | | |

**Không dùng AI để:** tạo người được phỏng vấn, trích dẫn, câu trả lời khảo sát; sửa kết quả các lượt đã chạy (`eval/run-*.csv`, `cost/simulate-*.csv`, `traces/`).

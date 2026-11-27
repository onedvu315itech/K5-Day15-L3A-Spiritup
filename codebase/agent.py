"""Luồng chính của bản chạy thử — NHÓM VIẾT. Điền ở guide bước 3.2.

`python run.py`, `python run.py eval` và `python run.py simulate` đều gọi answer(text).
"""
from ai import call_model
from tools import check_itinerary, get_opening_hours, get_travel_time, get_trending_spots, search_places
from tracing import note

SYSTEM = """Bạn là Roa — trợ lý lập lịch trình du lịch nhóm cho ứng dụng Partaway tại Việt Nam.
Quy tắc bắt buộc (CHỐNG BỊA ĐẶT):
1. Chỉ sử dụng địa điểm, giờ mở cửa, mức giá và thời gian di chuyển có trong dữ liệu công cụ được cung cấp. Tuyệt đối KHÔNG tự bịa, suy đoán hoặc lấy từ trí nhớ.
2. Nếu bất kỳ thông tin nào (địa điểm, giờ mở cửa, giá, thời gian di chuyển, thành phố) KHÔNG tìm thấy từ công cụ, phải trả lời rõ là "Không biết / Chưa có dữ liệu từ công cụ" cho đúng mục đó và để sẵn nhãn `[Cần kiểm tra & điền tay]` để người dùng tự tra cứu và điền bổ sung sau.
3. Nếu thiếu thông tin bắt buộc từ người dùng (số ngày, số người, ngân sách), hãy hỏi lại đúng phần thiếu trước khi xếp lịch.
4. Nếu ngân sách quá thấp hoặc ràng buộc không thể thoả mãn bằng dữ liệu hiện có, hãy nói rõ là không xếp được và giải thích lý do.
5. Không bao giờ tự xác nhận đã đặt bàn, đặt chỗ, thanh toán hay lưu lịch trình chính thức thay nhóm trưởng.
6. Trả lời bằng tiếng Việt, rõ ràng theo khung giờ, kèm tổng chi phí/người (chỉ tính trên các mục có dữ liệu) và lý do chọn."""

MAX_STEPS = 5


def answer(text: str) -> dict:
    city = "Đà Lạt" if ("đà lạt" in text.lower() or "da lat" in text.lower()) else "Khác"
    places = search_places(city, text)
    if not places:
        note("dừng: không tìm thấy dữ liệu trong công cụ — trả lời không biết & cho người dùng điền tay")
        reply = call_model(
            SYSTEM,
            f"Kết quả công cụ search_places: RỖNG (không có dữ liệu cho yêu cầu: {text}).\n"
            "Hãy báo rõ là không biết / chưa có dữ liệu từ công cụ, KHÔNG tự bịa địa điểm, "
            "và đưa ra khung trống `[Cần kiểm tra & điền tay]` để người dùng tự kiểm tra và điền sau.",
        )
        return {"output": reply["text"]}

    trending = get_trending_spots(city)
    hours = get_opening_hours([p["id"] for p in places[:3]])
    travel_min = get_travel_time(places[0]["area"], places[1]["area"]) if len(places) > 1 else 10
    sample_plan = [
        {"id": places[0]["id"], "start_hour": 8, "end_hour": 10},
        {"id": places[1]["id"], "start_hour": 11, "end_hour": 13},
    ]
    check_res = check_itinerary(sample_plan, budget_per_person_vnd=500000)

    context = (
        f"Địa điểm tìm được: {places}\n"
        f"Quán hot: {[t['name'] for t in trending]}\n"
        f"Giờ mở cửa: {hours}\n"
        f"Thời gian di chuyển mẫu: {travel_min} phút\n"
        f"Kết quả kiểm tra lịch mẫu: {check_res}"
    )
    reply = call_model(SYSTEM, f"Căn cứ công cụ:\n{context}\n\nYêu cầu người dùng:\n{text}")
    return {"output": reply["text"]}

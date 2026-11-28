"""Tra khoảng giá phòng/đêm của chỗ ở bằng Tavily Search, chỉ trong đợt thu kho (không gọi lúc `generate`).

Key gửi trong body, không log body hay key (R-22). Giá đọc được luôn coi là chưa xác minh, lưu kèm link nguồn.
"""
import json
import re
import urllib.error
import urllib.request

URL = "https://api.tavily.com/search"
TIMEOUT = 20
# Giá phòng/đêm hợp lý để nhận là giá (VND) *(tự ước tính)*: ngoài khoảng này coi là số khác (mã, năm, sao…).
PRICE_MIN, PRICE_MAX = 100_000, 20_000_000

# "450.000đ", "450,000 VND", "1.200.000 ₫", "450k", "1,2 triệu", "1.5tr"
_PRICE = re.compile(
    r"(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(triệu|tr\b|k\b|nghìn|ngàn|đ|₫|vnd|vnđ|dong|đồng)", re.I)


class TavilyError(Exception):
    """Lỗi gọi Tavily. Thông báo không chứa key."""


def parse_prices(text: str) -> list[int]:
    """Các số tiền VND trong một đoạn văn, đã lọc theo khoảng hợp lý."""
    out = []
    for num, unit in _PRICE.findall(text or ""):
        unit = unit.lower()
        if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", num):
            value = float(re.sub(r"[.,]", "", num))
        else:
            value = float(num.replace(",", "."))
        if unit in ("triệu", "tr"):
            value *= 1_000_000
        elif unit in ("k", "nghìn", "ngàn"):
            value *= 1_000
        v = int(round(value))
        if PRICE_MIN <= v <= PRICE_MAX:
            out.append(v)
    return out


class TavilyClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(self, query: str, max_results: int = 5) -> list[dict]:
        if not self.api_key:
            raise TavilyError("Chưa cấu hình TAVILY_API_KEY")
        body = json.dumps({"api_key": self.api_key, "query": query, "max_results": max_results,
                           "search_depth": "basic"}).encode("utf-8")
        req = urllib.request.Request(URL, data=body, method="POST", headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8")).get("results") or []
        except urllib.error.HTTPError as e:
            raise TavilyError(f"Tavily HTTP {e.code}") from None
        except urllib.error.URLError as e:
            raise TavilyError(f"Không gọi được Tavily: {e.reason}") from None
        except (TimeoutError, ValueError) as e:
            raise TavilyError(f"Không gọi được Tavily: {type(e).__name__}") from None


class TavilyPriceSource:
    """Nguồn giá phòng cho đợt thu kho. Test thay bằng nguồn giả có cùng hàm `room_price`."""

    def __init__(self, client: TavilyClient):
        self.client = client

    def room_price(self, name: str, city: str) -> dict | None:
        """{price_min_vnd, price_max_vnd, price_source_url} từ kết quả đầu tiên có giá đọc được, hoặc None.
        Chỉ lấy giá trong cùng một trang để không trộn giá của nơi khác."""
        for r in self.client.search(f"giá phòng {name} {city} một đêm"):
            prices = parse_prices(f"{r.get('title', '')} {r.get('content', '')}")
            if prices and r.get("url"):
                return {"price_min_vnd": min(prices), "price_max_vnd": max(prices), "price_source_url": r["url"]}
        return None

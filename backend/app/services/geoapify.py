"""Gọi Geoapify (Geocoding, Places) bằng urllib, có cache response thô trong `places_cache` (docs/DATABASE.md 2.10).

Key nằm trong URL nên không bao giờ log URL hay đưa URL vào thông báo lỗi (R-22).
Dữ liệu là OSM (ODbL): nơi hiển thị phải ghi nguồn (ATTRIBUTION).
"""
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta

from app.db.base import utcnow
from app.db.models import PlacesCache

BASE = "https://api.geoapify.com"
TIMEOUT = 30
ATTRIBUTION = "Dữ liệu địa điểm © OpenStreetMap contributors (ODbL). Powered by Geoapify."


class GeoapifyError(Exception):
    """Lỗi gọi Geoapify. Thông báo không chứa key hay URL."""


class GeoapifyClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def get(self, path: str, params: dict) -> dict:
        if not self.api_key:
            raise GeoapifyError("Chưa cấu hình GEOAPIFY_API_KEY")
        qs = urllib.parse.urlencode({**params, "apiKey": self.api_key})
        try:
            with urllib.request.urlopen(f"{BASE}{path}?{qs}", timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:200]
            raise GeoapifyError(f"Geoapify HTTP {e.code}: {body}") from None
        except urllib.error.URLError as e:
            raise GeoapifyError(f"Không gọi được Geoapify: {e.reason}") from None
        except (TimeoutError, ValueError) as e:
            raise GeoapifyError(f"Không gọi được Geoapify: {type(e).__name__}") from None


def cache_key(kind: str, path: str, params: dict) -> str:
    raw = json.dumps({"kind": kind, "path": path, "params": params}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class GeoapifySource:
    """Nguồn địa điểm cho đợt thu kho. Test thay bằng nguồn giả có cùng hai hàm."""

    def __init__(self, db, client: GeoapifyClient, ttl_days: int | None):
        self.db, self.client, self.ttl_days = db, client, ttl_days

    def _cached(self, kind: str, path: str, params: dict) -> dict:
        key = cache_key(kind, path, params)
        now = utcnow()
        row = self.db.get(PlacesCache, key)
        if row is not None and (row.expires_at is None or row.expires_at > now):
            return row.response
        data = self.client.get(path, params)
        expires = now + timedelta(days=self.ttl_days) if self.ttl_days else None
        if row is None:
            self.db.add(PlacesCache(key=key, kind=kind, response=data, fetched_at=now, expires_at=expires))
        else:
            row.response, row.fetched_at, row.expires_at = data, now, expires
        self.db.commit()
        return data

    def geocode_city(self, text: str) -> dict | None:
        """Tên điểm đến → {place_id, name, lat, lon} trong Việt Nam, hoặc None nếu không thấy."""
        data = self._cached("geocode", "/v1/geocode/search",
                            {"text": text, "type": "city", "filter": "countrycode:vn", "lang": "vi", "limit": 1,
                             "format": "json"})
        results = data.get("results") or []
        if not results:
            return None
        r = results[0]
        return {"place_id": r.get("place_id"), "name": r.get("city") or r.get("name"),
                "lat": r.get("lat"), "lon": r.get("lon")}

    def places(self, categories: str, place_id: str, lat, lon, limit: int, offset: int) -> list[dict]:
        """Một trang Places trong ranh giới thành phố, gần tâm trước. Trả danh sách feature thô."""
        params = {"categories": categories, "filter": f"place:{place_id}", "limit": limit, "offset": offset,
                  "lang": "vi"}
        if lat is not None and lon is not None:
            params["bias"] = f"proximity:{lon},{lat}"
        return self._cached("search", "/v2/places", params).get("features") or []

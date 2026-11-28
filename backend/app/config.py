"""Cấu hình đọc từ biến môi trường (hoặc file .env ở backend/ hoặc gốc repo). Không log giá trị (R-22)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Không đặt thì dùng SQLite trên máy để chạy thử; production là Supabase (pooler).
    database_url: str = "sqlite:///./partaway-dev.db"
    geoapify_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    frontend_base_url: str = "http://localhost:3000"

    # Kho địa điểm (docs/DATABASE.md mục 5).
    # Hạn kho: chưa chốt [NEEDS CLARIFICATION: OQ-12]. Để trống = kho không hết hạn, không tự thu lại.
    store_ttl_days: int | None = None
    store_max_cafe: int = 60          # *(tự ước tính, chưa kiểm bằng eval)*
    store_max_food: int = 60          # *(tự ước tính, chưa kiểm bằng eval)*
    store_page_size: int = 500        # Geoapify Places tối đa 500 nơi mỗi trang
    store_max_pages: int = 4          # mỗi nhóm loại, như scripts/spike_geoapify.py
    store_stuck_minutes: int = 10     # job collecting quá chừng này coi như treo *(tự ước tính)*
    store_max_lodging: int = 30       # *(tự ước tính, chưa kiểm bằng eval)*
    store_priced_lodging: int = 10    # số chỗ ở đầu bảng được tra giá Tavily mỗi đợt thu *(tự ước tính)*
    tavily_api_key: str = ""          # để trống = không tra giá phòng, chỗ ở ghi "giá chưa có"

    # Đề xuất (CR-001, chờ duyệt): thẻ đề xuất mở trong chừng này giờ rồi thành "tham khảo".
    proposal_ttl_hours: int = 48

    # Đăng nhập bằng email + mật khẩu và cookie (access_token + refresh_token).
    email: str = ""
    password: str = ""
    auth_secret_key: str = "partaway-dev-cookie-secret-change-in-prod"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

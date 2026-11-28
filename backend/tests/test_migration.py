"""Migration 0001–0002 chạy được trên SQLite và tạo đủ 13 bảng (Postgres kiểm bằng `alembic upgrade head --sql`)."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

BACKEND = Path(__file__).resolve().parents[1]
TABLES = {"city_stores", "places", "places_cache", "trending_spots", "trips", "trip_members", "plan_versions",
          "proposals", "votes", "suggestions", "agent_runs", "chat_messages", "trip_events"}


def test_upgrade_and_downgrade(tmp_path):
    url = f"sqlite:///{(tmp_path / 'm.db').as_posix()}"
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "app" / "db" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    eng = create_engine(url)
    assert TABLES <= set(inspect(eng).get_table_names())
    cols = {c["name"] for c in inspect(eng).get_columns("places")}
    assert {"geo_category", "geo_categories", "hours_unverified", "price_unverified", "rank", "price_min_vnd", "price_max_vnd",
            "price_source_url"} <= cols
    command.downgrade(cfg, "base")
    assert not TABLES & set(inspect(eng).get_table_names())
    eng.dispose()

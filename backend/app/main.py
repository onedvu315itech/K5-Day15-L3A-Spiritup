"""Ứng dụng FastAPI của Partaway. Chạy: `uvicorn app.main:app --reload` trong backend/."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.api import cities, health, plans, trips
from app.config import get_settings
from app.services.geoapify import GeoapifyClient, GeoapifySource
from app.services.tavily import TavilyClient, TavilyPriceSource


def create_app(settings=None, geo_factory=None, price_source=None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Partaway API", version="0.1.0")
    app.state.settings = settings
    # Giá phòng chỉ tra lúc thu kho; không có key thì bỏ qua (chỗ ở ghi "giá chưa có").
    if price_source is None and settings.tavily_api_key:
        price_source = TavilyPriceSource(TavilyClient(settings.tavily_api_key))
    app.state.price_source = price_source
    app.state.geo_factory = geo_factory or (
        lambda db: GeoapifySource(db, GeoapifyClient(settings.geoapify_api_key), settings.store_ttl_days))
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list(), allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])
    errors.install(app)
    app.include_router(health.router)
    app.include_router(trips.router)
    app.include_router(cities.router)
    app.include_router(plans.router)
    return app


logging.basicConfig(level=logging.INFO)
app = create_app()

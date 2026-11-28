"""Ứng dụng FastAPI của Partaway. Chạy: `uvicorn app.main:app --reload` trong backend/."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.api import cities, health, trips
from app.config import get_settings
from app.services.geoapify import GeoapifyClient, GeoapifySource


def create_app(settings=None, geo_factory=None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Partaway API", version="0.1.0")
    app.state.settings = settings
    app.state.geo_factory = geo_factory or (
        lambda db: GeoapifySource(db, GeoapifyClient(settings.geoapify_api_key), settings.store_ttl_days))
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list(), allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])
    errors.install(app)
    app.include_router(health.router)
    app.include_router(trips.router)
    app.include_router(cities.router)
    return app


logging.basicConfig(level=logging.INFO)
app = create_app()

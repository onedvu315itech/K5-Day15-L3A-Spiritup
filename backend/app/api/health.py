from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.db.base import get_db

router = APIRouter()


@router.get("/health")
def health(db=Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:  # noqa: BLE001 — không lộ chuỗi kết nối (R-22)
        return {"status": "degraded", "db": "error"}

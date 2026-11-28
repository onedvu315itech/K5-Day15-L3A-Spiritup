"""Định dạng lỗi chung (docs/API_SPEC.md mục 1.3). `message` tiếng Việt, không trả stack trace."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details or {}


def error_response(status: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message, "details": details or {}}})


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, e: ApiError):
        return error_response(e.status, e.code, e.message, e.details)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError):
        fields = [{"field": ".".join(str(x) for x in err.get("loc", [])[1:]), "msg": err.get("msg")}
                  for err in e.errors()]
        return error_response(400, "bad_request", "Thiếu trường hoặc sai kiểu dữ liệu.", {"fields": fields})

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        if e.status_code == 404:
            return error_response(404, "not_found", "Không tìm thấy.")
        return error_response(e.status_code, "bad_request", str(e.detail))

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.routers import analysis, export, images, projects, settings, similarity
from app.services.logging_service import setup_logging
from app.services.runtime_paths import get_config_path, get_logs_dir, get_storage_dir
from app.services.settings_service import ensure_settings_file

setup_logging()

app = FastAPI(title="青影智筛 API", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "file://",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    ensure_settings_file()


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "data": None, "message": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"success": False, "data": None, "message": "请求参数不合法"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"success": False, "data": None, "message": f"服务内部错误：{exc}"},
    )


@app.get("/health")
def health_check():
    return {
        "success": True,
        "data": {
            "status": "ok",
            "storage_dir": str(get_storage_dir()),
            "config_path": str(get_config_path()),
            "logs_dir": str(get_logs_dir()),
        },
        "message": "",
    }


@app.get("/api/health")
def api_health_check():
    return health_check()


app.include_router(projects.router)
app.include_router(images.photos_router)
app.include_router(images.project_photos_router)
app.include_router(images.images_router)
app.include_router(analysis.router)
app.include_router(analysis.ai_router)
app.include_router(similarity.router)
app.include_router(export.router)
app.include_router(export.direct_router)
app.include_router(settings.router)

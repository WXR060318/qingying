from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import STORAGE_DIR, get_db
from app.models import Photo, Project
from app.routers.common import get_photo_or_404, ok, serialize_photo
from app.routers.projects import scan_project_photos
from app.schemas import (
    FolderImportRequest,
    ManualStatusUpdate,
    PhotoUpdate,
    ProjectActionRequest,
    ReviewUpdateRequest,
    ScanRequest,
)
from app.services.image_quality_service import create_thumbnail, thumbnail_cache_path


photos_router = APIRouter(prefix="/api/photos", tags=["photos"])
project_photos_router = APIRouter(prefix="/api/projects/{project_id}/photos", tags=["photos"])
images_router = APIRouter(prefix="/api/images", tags=["images"])


@photos_router.get("/{photo_id}")
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = get_photo_or_404(db, photo_id)
    return ok(serialize_photo(db, photo))


@photos_router.patch("/{photo_id}")
def update_photo(photo_id: int, payload: PhotoUpdate, db: Session = Depends(get_db)):
    photo = get_photo_or_404(db, photo_id)
    values = payload.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(photo, key, value.strip() if isinstance(value, str) else value)
    photo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(photo)
    return ok(serialize_photo(db, photo), "照片复核信息已保存")


@photos_router.get("/{photo_id}/thumbnail")
def get_photo_thumbnail(photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    photo = get_photo_or_404(db, photo_id)
    return _thumbnail_response(photo, db)


@project_photos_router.get("/{photo_id}/thumbnail")
def get_project_photo_thumbnail(
    project_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    photo = get_photo_or_404(db, photo_id)
    if photo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="缩略图不存在")
    return _thumbnail_response(photo, db)


@project_photos_router.get("/{photo_id}/file")
def get_project_photo_file(
    project_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    photo = get_photo_or_404(db, photo_id)
    if photo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="原始图片不存在")
    return _file_response(Path(photo.file_path))


def _thumbnail_response(photo: Photo, db: Session) -> FileResponse:
    original = Path(photo.file_path)
    if original.exists() and original.is_file():
        expected_thumbnail = thumbnail_cache_path(
            STORAGE_DIR,
            photo.project_id,
            photo.id,
            photo.file_path,
        )
        thumbnail_path = create_thumbnail(photo.file_path, expected_thumbnail)
        if thumbnail_path:
            if photo.thumbnail_path != thumbnail_path:
                photo.thumbnail_path = thumbnail_path
                photo.updated_at = datetime.utcnow()
                db.commit()
            return _file_response(Path(thumbnail_path))
        return _file_response(original)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="缩略图不存在")


@photos_router.get("/{photo_id}/file")
def get_photo_file(photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    photo = get_photo_or_404(db, photo_id)
    return _file_response(Path(photo.file_path))


def _file_response(path: Path) -> FileResponse:
    if path.exists() and path.is_file():
        return FileResponse(
            path,
            headers={
                "Cache-Control": "no-store, max-age=0",
                "Pragma": "no-cache",
            },
        )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")


@images_router.get("/{photo_id}")
def get_image(photo_id: int, db: Session = Depends(get_db)):
    return get_photo(photo_id, db)


@images_router.post("/import-folder")
def import_folder(payload: FolderImportRequest, db: Session = Depends(get_db)):
    project_id = payload.project_id
    if project_id is None:
        folder = Path(payload.folder_path).expanduser()
        project = Project(
            name=(payload.project_name or folder.name or "未命名项目").strip(),
            source_path=str(folder),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        project_id = project.id
    return scan_project_photos(project_id, ScanRequest(folder_path=payload.folder_path), db)


@images_router.post("/analyze")
def analyze_images(payload: ProjectActionRequest, db: Session = Depends(get_db)):
    from app.routers.analysis import analyze_project_local

    return analyze_project_local(payload.project_id, db)


@images_router.post("/cluster-similar")
def cluster_similar_images(payload: ProjectActionRequest, db: Session = Depends(get_db)):
    from app.routers.similarity import build_project_similar_groups

    return build_project_similar_groups(payload.project_id, db)


@images_router.post("/update-review")
def update_review(payload: ReviewUpdateRequest, db: Session = Depends(get_db)):
    values = payload.model_dump(exclude={"photo_id"}, exclude_unset=True)
    return update_photo(payload.photo_id, PhotoUpdate(**values), db)


@images_router.patch("/{photo_id}/manual-status")
def update_manual_status(
    photo_id: int,
    payload: ManualStatusUpdate,
    db: Session = Depends(get_db),
):
    mapped = {
        "accepted": "keep",
        "selected": "keep",
        "rejected": "reject",
        "pending": "pending",
        "keep": "keep",
        "candidate": "candidate",
        "reject": "reject",
    }.get(payload.manual_status, "pending")
    return update_photo(photo_id, PhotoUpdate(status=mapped), db)


@images_router.get("/{photo_id}/thumbnail")
def get_thumbnail(photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return get_photo_thumbnail(photo_id, db)


@images_router.get("/{photo_id}/file")
def get_image_file(photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return get_photo_file(photo_id, db)


# Preserve the old import name used by app.main.
router = images_router

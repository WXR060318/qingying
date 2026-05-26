import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import STORAGE_DIR, get_db
from app.models import Photo, Project
from app.routers.common import (
    apply_photo_filters,
    get_project_or_404,
    ok,
    safe_resolved_folder,
    serialize_photo,
    serialize_project,
)
from app.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ScanRequest,
    ScanResult,
)
from app.services.image_quality_service import (
    create_thumbnail,
    encode_tags,
    read_basic_metadata,
    thumbnail_cache_path,
)
from app.services.task_status import set_task_status


router = APIRouter(prefix="/api/projects", tags=["projects"])
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@router.get("")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    return ok([serialize_project(db, project) for project in projects])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(**_clean_project_payload(payload.model_dump()))
    db.add(project)
    db.commit()
    db.refresh(project)
    logger.info("项目已创建：%s", project.name)
    return ok(serialize_project(db, project), "项目已创建")


@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_project_v3(payload: ProjectCreate, db: Session = Depends(get_db)):
    return create_project(payload, db)


@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    return ok(serialize_project(db, project))


@router.patch("/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    values = _clean_project_payload(payload.model_dump(exclude_unset=True))
    for key, value in values.items():
        setattr(project, key, value)
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return ok(serialize_project(db, project), "项目信息已更新")


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    db.delete(project)
    db.commit()
    return ok({"id": project_id}, "项目记录已删除")


@router.get("/{project_id}/photos")
def list_project_photos(
    project_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = None,
    issue_tag: str | None = None,
    search: str | None = None,
    sort: str | None = None,
    db: Session = Depends(get_db),
):
    get_project_or_404(db, project_id)
    query = db.query(Photo).filter(Photo.project_id == project_id)
    query = apply_photo_filters(query, status_filter, category, issue_tag, search, sort)
    photos = query.all()
    return ok([serialize_photo(db, photo) for photo in photos])


@router.get("/{project_id}/images")
def list_project_images(project_id: int, db: Session = Depends(get_db)):
    return list_project_photos(project_id=project_id, db=db)


@router.post("/{project_id}/scan")
def scan_project_photos(
    project_id: int,
    payload: ScanRequest,
    db: Session = Depends(get_db),
):
    project = get_project_or_404(db, project_id)
    source = payload.folder_path or project.source_path
    if not source:
        return ok(
            ScanResult(
                project_id=project_id,
                source_path="",
                scanned_count=0,
                imported_count=0,
                updated_count=0,
                skipped_count=0,
                failed_count=1,
                errors=["请先选择照片源文件夹"],
            ).model_dump(),
            "缺少照片源文件夹",
        )
    folder = safe_resolved_folder(source)
    project.source_path = str(folder)
    project.updated_at = datetime.utcnow()
    set_task_status(project_id, "scan", "running", progress=0, message="正在扫描照片文件夹")

    files = [
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    existing = {
        row[0]: row[1]
        for row in db.query(Photo.file_path, Photo.id)
        .filter(Photo.project_id == project_id)
        .all()
    }
    imported_count = 0
    updated_count = 0
    skipped_count = 0
    failed_count = 0
    errors: list[str] = []

    for index, path in enumerate(files, start=1):
        resolved_path = str(path.resolve())
        try:
            metadata = read_basic_metadata(resolved_path)
            if resolved_path in existing:
                photo = db.query(Photo).filter(Photo.id == existing[resolved_path]).first()
                if not photo:
                    skipped_count += 1
                    continue
                _apply_metadata(photo, metadata)
                updated_count += 1
            else:
                photo = Photo(
                    project_id=project_id,
                    file_name=path.name,
                    file_path=resolved_path,
                    status="pending",
                    issue_tags=encode_tags([]),
                )
                _apply_metadata(photo, metadata)
                db.add(photo)
                db.flush()
                imported_count += 1
                existing[resolved_path] = photo.id
            thumbnail_path = thumbnail_cache_path(STORAGE_DIR, project_id, photo.id, resolved_path)
            photo.thumbnail_path = create_thumbnail(
                resolved_path,
                thumbnail_path,
                force=photo.thumbnail_path != str(thumbnail_path),
            )
        except Exception as exc:
            failed_count += 1
            errors.append(f"{path.name}: {exc}")
        if index % max(1, len(files) // 100 or 1) == 0:
            set_task_status(
                project_id,
                "scan",
                "running",
                progress=round(index / max(len(files), 1), 3),
                message=f"正在导入照片 {index}/{len(files)}",
            )

    db.commit()
    result = ScanResult(
        project_id=project_id,
        source_path=str(folder),
        scanned_count=len(files),
        imported_count=imported_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        errors=errors[:50],
    )
    set_task_status(
        project_id,
        "scan",
        "completed",
        progress=1,
        message="照片导入完成",
        result=result.model_dump(),
    )
    logger.info(
        "项目 %s 照片扫描完成：扫描 %s，新增 %s，更新 %s，失败 %s",
        project_id,
        len(files),
        imported_count,
        updated_count,
        failed_count,
    )
    return ok(result.model_dump(), "照片扫描完成")


@router.post("/{project_id}/import")
def import_project_images(
    project_id: int,
    payload: ScanRequest,
    db: Session = Depends(get_db),
):
    return scan_project_photos(project_id, payload, db)


def _apply_metadata(photo: Photo, metadata: dict) -> None:
    photo.file_size = metadata.get("file_size")
    photo.width = metadata.get("width")
    photo.height = metadata.get("height")
    photo.image_format = metadata.get("image_format")
    photo.exif_datetime = metadata.get("exif_datetime")
    photo.updated_at = datetime.utcnow()


def _clean_project_payload(values: dict) -> dict:
    cleaned = {}
    for key, value in values.items():
        cleaned[key] = value.strip() if isinstance(value, str) else value
    return cleaned

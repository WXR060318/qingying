import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import AIAnalysis, Photo, Project, SimilarGroup
from app.schemas import AIAnalysisOut, PhotoOut, ProjectOut
from app.services.image_quality_service import decode_tags


def ok(data=None, message: str = "") -> dict[str, Any]:
    return {"success": True, "data": data, "message": message}


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return project


def get_photo_or_404(db: Session, photo_id: int) -> Photo:
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片不存在")
    return photo


def serialize_project(db: Session, project: Project) -> dict[str, Any]:
    count = db.query(Photo).filter(Photo.project_id == project.id).count()
    return ProjectOut(
        id=project.id,
        name=project.name,
        event_type=project.event_type,
        event_date=project.event_date,
        location=project.location,
        photographer=project.photographer,
        source_path=project.source_path,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        photo_count=count,
        image_count=count,
    ).model_dump()


def serialize_photo(db: Session, photo: Photo) -> dict[str, Any]:
    group = (
        db.query(SimilarGroup)
        .join(SimilarGroup.photos)
        .filter(SimilarGroup.photos.any(photo_id=photo.id))
        .first()
    )
    latest_ai = (
        db.query(AIAnalysis)
        .filter(AIAnalysis.photo_id == photo.id)
        .order_by(AIAnalysis.created_at.desc())
        .first()
    )
    issue_tags = decode_tags(photo.issue_tags)
    ai_out = serialize_ai_analysis(latest_ai) if latest_ai else None
    status = photo.status or "pending"
    exposure_status = _exposure_status_from_tags(issue_tags)
    resolution_status = "low" if "分辨率低" in issue_tags else "normal"
    return PhotoOut(
        id=photo.id,
        project_id=photo.project_id,
        file_name=photo.file_name,
        file_path=photo.file_path,
        thumbnail_path=photo.thumbnail_path,
        file_size=photo.file_size,
        width=photo.width,
        height=photo.height,
        image_format=photo.image_format,
        exif_datetime=photo.exif_datetime,
        blur_score=photo.blur_score,
        exposure_score=photo.exposure_score,
        resolution_score=photo.resolution_score,
        composition_score=photo.composition_score,
        total_score=photo.total_score,
        issue_tags=issue_tags,
        perceptual_hash=photo.perceptual_hash,
        ai_category=photo.ai_category,
        user_category=photo.user_category,
        recommended_usage=photo.recommended_usage,
        status=status,
        notes=photo.notes,
        is_similar_recommended=bool(group and group.recommended_photo_id == photo.id),
        similar_group_id=group.id if group else None,
        latest_ai_analysis=ai_out,
        created_at=photo.created_at,
        updated_at=photo.updated_at,
        quality_flags=issue_tags,
        image_hash=photo.perceptual_hash,
        similarity_group_id=group.id if group else None,
        is_duplicate_candidate=bool(group and group.recommended_photo_id != photo.id),
        is_best_in_group=bool(group and group.recommended_photo_id == photo.id),
        auto_score=photo.total_score,
        suggest_status=_legacy_suggest_status(status),
        manual_status=_legacy_manual_status(status),
        brightness_score=photo.exposure_score,
        exposure_status=exposure_status,
        resolution_status=resolution_status,
    ).model_dump()


def serialize_ai_analysis(analysis: AIAnalysis) -> AIAnalysisOut:
    try:
        tags = json.loads(analysis.tags or "[]")
    except json.JSONDecodeError:
        tags = []
    return AIAnalysisOut(
        id=analysis.id,
        photo_id=analysis.photo_id,
        provider=analysis.provider,
        scene_type=analysis.scene_type,
        description=analysis.description,
        recommended_usage=analysis.recommended_usage,
        reason=analysis.reason,
        tags=tags if isinstance(tags, list) else [],
        confidence=analysis.confidence,
        raw_response=analysis.raw_response,
        created_at=analysis.created_at,
    )


def apply_photo_filters(query, status_filter, category, issue_tag, search, sort):
    if status_filter and status_filter != "all":
        query = query.filter(Photo.status == status_filter)
    if category and category != "all":
        query = query.filter(or_(Photo.user_category == category, Photo.ai_category == category))
    if issue_tag and issue_tag != "all":
        query = query.filter(Photo.issue_tags.contains(issue_tag))
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Photo.file_name.ilike(like),
                Photo.notes.ilike(like),
                Photo.issue_tags.ilike(like),
                Photo.user_category.ilike(like),
                Photo.ai_category.ilike(like),
            )
        )
    if sort == "score_asc":
        query = query.order_by(Photo.total_score.asc().nullslast(), Photo.id.asc())
    elif sort == "blur_desc":
        query = query.order_by(Photo.blur_score.desc().nullslast(), Photo.id.asc())
    elif sort == "exposure_desc":
        query = query.order_by(Photo.exposure_score.desc().nullslast(), Photo.id.asc())
    else:
        query = query.order_by(Photo.total_score.desc().nullslast(), Photo.id.asc())
    return query


def safe_resolved_folder(folder_path: str) -> Path:
    folder = Path(folder_path).expanduser()
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="照片源文件夹不存在或不是文件夹",
        )
    return folder.resolve()


def _legacy_suggest_status(status_value: str) -> str:
    if status_value == "keep":
        return "keep"
    if status_value == "reject":
        return "reject"
    return "review"


def _legacy_manual_status(status_value: str) -> str:
    return {
        "keep": "accepted",
        "candidate": "pending",
        "reject": "rejected",
        "pending": "pending",
    }.get(status_value, "pending")


def _exposure_status_from_tags(tags: list[str]) -> str:
    if "欠曝" in tags:
        return "underexposed"
    if "过曝" in tags:
        return "overexposed"
    return "normal"

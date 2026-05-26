import json
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AIAnalysis, Photo
from app.routers.common import get_photo_or_404, get_project_or_404, ok
from app.schemas import (
    AIAnalyzeImageRequest,
    LocalAnalyzeResult,
    VisionAnalyzeRequest,
    VisionAnalyzeResult,
)
from app.services.image_quality_service import analyze_image_quality, encode_tags
from app.services.settings_service import get_float_setting, get_settings, setting_is_true
from app.services.task_status import get_project_status, set_task_status
from app.services.vision_model_service import VisionModelError, VisionModelService


router = APIRouter(prefix="/api/projects", tags=["analysis"])
ai_router = APIRouter(prefix="/api/ai", tags=["ai"])
logger = logging.getLogger(__name__)


@router.post("/{project_id}/analyze/local")
def analyze_project_local(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(db, project_id)
    settings = get_settings(db)
    blur_threshold = get_float_setting(settings, "blurThreshold", 80.0)
    exposure_threshold = get_float_setting(settings, "exposureThreshold", 55.0)
    photos = (
        db.query(Photo)
        .filter(Photo.project_id == project_id)
        .order_by(Photo.id.asc())
        .all()
    )
    set_task_status(
        project_id,
        "local_analysis",
        "running",
        progress=0,
        message="正在准备本地质量分析",
    )
    failed_count = 0
    for index, photo in enumerate(photos, start=1):
        quality = analyze_image_quality(
            photo.file_path,
            blur_threshold=blur_threshold,
            exposure_threshold=exposure_threshold,
        )
        photo.width = quality.get("width")
        photo.height = quality.get("height")
        photo.file_size = quality.get("file_size")
        photo.image_format = quality.get("image_format")
        photo.exif_datetime = quality.get("exif_datetime")
        photo.blur_score = quality.get("blur_score")
        photo.exposure_score = quality.get("exposure_score")
        photo.resolution_score = quality.get("resolution_score")
        photo.composition_score = quality.get("composition_score")
        photo.total_score = quality.get("total_score")
        photo.issue_tags = encode_tags(quality.get("issue_tags") or [])
        if photo.status == "pending" or not photo.status:
            photo.status = quality.get("status") or "pending"
        photo.updated_at = datetime.utcnow()
        if photo.total_score is None:
            failed_count += 1
        if index % max(1, len(photos) // 100 or 1) == 0:
            set_task_status(
                project_id,
                "local_analysis",
                "running",
                progress=round(index / max(len(photos), 1), 3),
                message=f"正在分析照片 {index}/{len(photos)}",
            )
    db.commit()
    result = LocalAnalyzeResult(
        project_id=project_id,
        analyzed_count=len(photos),
        failed_count=failed_count,
    )
    set_task_status(
        project_id,
        "local_analysis",
        "completed",
        progress=1,
        message="本地质量分析完成",
        result=result.model_dump(),
    )
    logger.info("项目 %s 本地质量分析完成：%s 张，失败 %s 张", project_id, len(photos), failed_count)
    return ok(result.model_dump(), "本地质量分析完成")


@router.post("/{project_id}/analyze")
def analyze_project_legacy(project_id: int, db: Session = Depends(get_db)):
    return analyze_project_local(project_id, db)


@router.post("/{project_id}/analyze/vision")
def analyze_project_vision(
    project_id: int,
    payload: VisionAnalyzeRequest | None = None,
    db: Session = Depends(get_db),
):
    get_project_or_404(db, project_id)
    settings = get_settings(db)
    provider_name = settings.get("vision.provider") or "openai"
    if not setting_is_true(settings.get("vision.enabled")):
        result = VisionAnalyzeResult(
            project_id=project_id,
            provider=provider_name,
            analyzed_count=0,
            failed_count=0,
            fallback_to_local=True,
            errors=["大模型分析未启用，已保留本地算法结果"],
        )
        set_task_status(
            project_id,
            "vision_analysis",
            "skipped",
            progress=1,
            message="大模型未启用",
            result=result.model_dump(),
        )
        return ok(result.model_dump(), "大模型未启用，已自动降级")

    query = db.query(Photo).filter(Photo.project_id == project_id)
    if payload and payload.photo_ids:
        query = query.filter(Photo.id.in_(payload.photo_ids))
    query = query.order_by(Photo.id.asc())
    if payload and payload.limit:
        query = query.limit(payload.limit)
    photos = query.all()

    service = VisionModelService(settings)
    analyzed_count = 0
    failed_count = 0
    errors: list[str] = []
    set_task_status(
        project_id,
        "vision_analysis",
        "running",
        progress=0,
        message="正在准备大模型分析",
    )

    for index, photo in enumerate(photos, start=1):
        try:
            result = service.analyze(photo.file_path)
            analysis = AIAnalysis(
                photo_id=photo.id,
                provider=provider_name,
                scene_type=result.get("scene_type"),
                description=result.get("description"),
                recommended_usage=result.get("recommended_usage"),
                reason=result.get("reason"),
                tags=json.dumps(result.get("tags") or [], ensure_ascii=False),
                confidence=result.get("confidence"),
                raw_response=json.dumps(result.get("raw_response", result), ensure_ascii=False),
            )
            db.add(analysis)
            photo.ai_category = result.get("scene_type")
            if not photo.user_category:
                photo.user_category = result.get("scene_type")
            photo.recommended_usage = result.get("recommended_usage")
            photo.updated_at = datetime.utcnow()
            analyzed_count += 1
        except VisionModelError as exc:
            failed_count += 1
            errors.append(f"{photo.file_name}: {exc}")
        except Exception as exc:
            failed_count += 1
            errors.append(f"{photo.file_name}: 大模型分析失败 {exc}")
        if index % max(1, len(photos) // 100 or 1) == 0:
            set_task_status(
                project_id,
                "vision_analysis",
                "running",
                progress=round(index / max(len(photos), 1), 3),
                message=f"正在进行大模型分析 {index}/{len(photos)}",
            )
    db.commit()
    result = VisionAnalyzeResult(
        project_id=project_id,
        provider=provider_name,
        analyzed_count=analyzed_count,
        failed_count=failed_count,
        fallback_to_local=failed_count > 0,
        errors=errors[:50],
    )
    set_task_status(
        project_id,
        "vision_analysis",
        "completed",
        progress=1,
        message="大模型分析完成",
        result=result.model_dump(),
    )
    message = "大模型分析完成" if analyzed_count else "大模型不可用，已自动降级为本地结果"
    logger.info("项目 %s 大模型分析完成：成功 %s 张，失败 %s 张", project_id, analyzed_count, failed_count)
    return ok(result.model_dump(), message)


@router.get("/{project_id}/analysis-status")
def get_analysis_status(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(db, project_id)
    status = get_project_status(project_id)
    return ok(
        {
            "project_id": project_id,
            "scan": status.get("scan"),
            "local_analysis": status.get("local_analysis"),
            "vision_analysis": status.get("vision_analysis"),
            "similarity": status.get("similarity"),
            "export": status.get("export"),
        }
    )


@ai_router.post("/analyze-image")
def analyze_single_image(
    payload: AIAnalyzeImageRequest,
    db: Session = Depends(get_db),
):
    settings = get_settings(db)
    provider_name = settings.get("visionProvider") or settings.get("vision.provider") or "openai"
    photo: Photo | None = None
    image_path = payload.file_path
    if payload.photo_id:
        photo = get_photo_or_404(db, payload.photo_id)
        image_path = photo.file_path
    if not image_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请提供 photo_id 或 file_path")

    if not setting_is_true(settings.get("enableVisionModel") or settings.get("vision.enabled")):
        return ok(
            {
                "enabled": False,
                "mock": True,
                "provider": provider_name,
                "photo_id": photo.id if photo else None,
                "file_path": image_path,
                "scene_type": "待人工确认",
                "description": "大模型未启用，当前返回本地 mock 分析结果。",
                "recommended_usage": "活动归档",
                "reason": "第三版保留统一接口，便于后续接入 OpenAI Vision、Qwen-VL、Gemini Vision、DeepSeek 多模态或本地模型。",
                "tags": [],
                "confidence": 0.0,
            },
            "大模型未启用，返回 mock 结果",
        )

    if not Path(image_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片文件不存在")

    try:
        result = VisionModelService(settings).analyze(image_path)
    except VisionModelError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if photo:
        analysis = AIAnalysis(
            photo_id=photo.id,
            provider=str(provider_name),
            scene_type=result.get("scene_type"),
            description=result.get("description"),
            recommended_usage=result.get("recommended_usage"),
            reason=result.get("reason"),
            tags=json.dumps(result.get("tags") or [], ensure_ascii=False),
            confidence=result.get("confidence"),
            raw_response=json.dumps(result.get("raw_response", result), ensure_ascii=False),
        )
        db.add(analysis)
        photo.ai_category = result.get("scene_type")
        photo.recommended_usage = result.get("recommended_usage")
        photo.updated_at = datetime.utcnow()
        db.commit()

    return ok(
        {
            "enabled": True,
            "mock": False,
            "provider": provider_name,
            "photo_id": photo.id if photo else None,
            **result,
        },
        "大模型图片分析完成",
    )

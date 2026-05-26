from datetime import datetime
from pathlib import Path
from shutil import copy2
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.database import STORAGE_DIR
from app.models import AIAnalysis, ExportRecord, Photo, Project, SimilarGroup
from app.services.image_quality_service import decode_tags
from app.services.settings_service import get_settings
from app.services.task_status import set_task_status


STATUS_DIRS = {
    "keep": "01_保留照片",
    "candidate": "02_备选照片",
    "reject": "03_淘汰照片",
    "pending": "04_待确认照片",
}

DEFAULT_CATEGORY = "待人工确认"

REPORT_FIELDS = [
    "项目名称",
    "活动类型",
    "活动日期",
    "文件名",
    "原始路径",
    "导出路径",
    "图片宽度",
    "图片高度",
    "文件大小",
    "清晰度评分",
    "曝光评分",
    "分辨率评分",
    "构图评分",
    "综合评分",
    "AI 分类",
    "人工分类",
    "推荐用途",
    "当前状态",
    "问题标签",
    "相似组编号",
    "是否相似组推荐图",
    "大模型图片说明",
    "大模型推荐理由",
    "人工备注",
]


def export_project_assets(
    db: Session,
    project: Project,
    export_dir: str | None = None,
    export_range: str = "keep_candidate",
    include_excel: bool = True,
) -> dict[str, Any]:
    photos = (
        db.query(Photo)
        .filter(Photo.project_id == project.id)
        .order_by(Photo.id.asc())
        .all()
    )
    selected_photos = [photo for photo in photos if _in_export_range(photo, export_range)]

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    settings = get_settings(db)
    configured_export_dir = export_dir or settings.get("defaultExportDir") or settings.get("export.default_dir")
    root = (
        Path(str(configured_export_dir)).expanduser() / f"project_{project.id}_{stamp}"
        if configured_export_dir
        else STORAGE_DIR / "exports" / f"project_{project.id}_{stamp}"
    )
    root.mkdir(parents=True, exist_ok=True)

    recommended_by_photo = _recommended_group_lookup(db, project.id)
    latest_ai_by_photo = _latest_ai_lookup(db, [photo.id for photo in photos])
    rows: list[dict[str, Any]] = []
    counts = {"keep": 0, "candidate": 0, "reject": 0, "pending": 0}
    copied_count = 0
    skipped_missing_count = 0
    errors: list[str] = []

    for index, photo in enumerate(selected_photos, start=1):
        if selected_photos and index % max(1, len(selected_photos) // 100 or 1) == 0:
            set_task_status(
                project.id,
                "export",
                "running",
                progress=round(index / max(len(selected_photos), 1), 3),
                message=f"正在导出照片 {index}/{len(selected_photos)}",
            )
        status = photo.status if photo.status in STATUS_DIRS else "pending"
        counts[status] += 1
        category = _sanitize_path_part(photo.user_category or photo.ai_category or DEFAULT_CATEGORY)
        target_dir = root / STATUS_DIRS[status] / category
        target_dir.mkdir(parents=True, exist_ok=True)
        source = Path(photo.file_path)
        exported_path: str | None = None

        if source.exists() and source.is_file():
            try:
                target = _unique_target(target_dir / source.name)
                copy2(source, target)
                exported_path = str(target)
                copied_count += 1
            except Exception as exc:
                errors.append(f"{photo.file_name}: 导出失败 {exc}")
        else:
            skipped_missing_count += 1
            errors.append(f"{photo.file_name}: 原始文件缺失")

        ai = latest_ai_by_photo.get(photo.id)
        rows.append(
            {
                "项目名称": project.name,
                "活动类型": project.event_type,
                "活动日期": project.event_date,
                "文件名": photo.file_name,
                "原始路径": photo.file_path,
                "导出路径": exported_path,
                "图片宽度": photo.width,
                "图片高度": photo.height,
                "文件大小": photo.file_size,
                "清晰度评分": photo.blur_score,
                "曝光评分": photo.exposure_score,
                "分辨率评分": photo.resolution_score,
                "构图评分": photo.composition_score,
                "综合评分": photo.total_score,
                "AI 分类": photo.ai_category,
                "人工分类": photo.user_category,
                "推荐用途": photo.recommended_usage,
                "当前状态": _status_label(photo.status),
                "问题标签": "、".join(decode_tags(photo.issue_tags)),
                "相似组编号": recommended_by_photo.get(photo.id, {}).get("group_id"),
                "是否相似组推荐图": "是"
                if recommended_by_photo.get(photo.id, {}).get("is_recommended")
                else "否",
                "大模型图片说明": ai.description if ai else None,
                "大模型推荐理由": ai.reason if ai else None,
                "人工备注": photo.notes,
            }
        )

    report_path: str | None = None
    if include_excel:
        report = root / "筛选报告.xlsx"
        pd.DataFrame(rows, columns=REPORT_FIELDS).to_excel(report, index=False)
        report_path = str(report)

    record = ExportRecord(
        project_id=project.id,
        export_path=str(root),
        keep_count=counts["keep"],
        candidate_count=counts["candidate"],
        reject_count=counts["reject"],
        report_path=report_path,
    )
    db.add(record)
    db.commit()

    return {
        "project_id": project.id,
        "export_dir": str(root),
        "report_path": report_path,
        "keep_count": counts["keep"],
        "candidate_count": counts["candidate"],
        "reject_count": counts["reject"],
        "pending_count": counts["pending"],
        "copied_count": copied_count,
        "skipped_missing_count": skipped_missing_count,
        "errors": errors[:100],
        "accepted_count": counts["keep"],
        "review_count": counts["candidate"] + counts["pending"],
        "rejected_count": counts["reject"],
    }


def _in_export_range(photo: Photo, export_range: str) -> bool:
    if export_range == "keep_only":
        return photo.status == "keep"
    if export_range == "reject_only":
        return photo.status == "reject"
    if export_range == "recommended_only":
        return photo.recommended_usage == "推文封面候选"
    if export_range == "all":
        return True
    return photo.status in {"keep", "candidate"}


def _unique_target(target: Path) -> Path:
    if not target.exists():
        return target
    stem = target.stem
    suffix = target.suffix
    counter = 1
    while True:
        candidate = target.with_name(f"{stem}_{counter}{suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def _sanitize_path_part(value: str) -> str:
    cleaned = "".join("_" if char in '<>:"/\\|?*' else char for char in value).strip()
    return cleaned or DEFAULT_CATEGORY


def _status_label(status: str) -> str:
    return {
        "keep": "保留",
        "candidate": "备选",
        "reject": "淘汰",
        "pending": "待确认",
    }.get(status, status)


def _recommended_group_lookup(db: Session, project_id: int) -> dict[int, dict[str, Any]]:
    lookup: dict[int, dict[str, Any]] = {}
    groups = db.query(SimilarGroup).filter(SimilarGroup.project_id == project_id).all()
    for group in groups:
        for item in group.photos:
            lookup[item.photo_id] = {
                "group_id": group.id,
                "is_recommended": item.photo_id == group.recommended_photo_id,
            }
    return lookup


def _latest_ai_lookup(db: Session, photo_ids: list[int]) -> dict[int, AIAnalysis]:
    if not photo_ids:
        return {}
    analyses = (
        db.query(AIAnalysis)
        .filter(AIAnalysis.photo_id.in_(photo_ids))
        .order_by(AIAnalysis.created_at.desc())
        .all()
    )
    result: dict[int, AIAnalysis] = {}
    for analysis in analyses:
        result.setdefault(analysis.photo_id, analysis)
    return result

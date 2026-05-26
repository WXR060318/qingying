import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Photo, PhotoSimilarity, SimilarGroup
from app.routers.common import get_project_or_404, ok, serialize_photo
from app.schemas import RecommendedPhotoUpdate, SimilarBuildResult, SimilarGroupOut, SimilarPhotoOut
from app.services.settings_service import get_int_setting, get_settings
from app.services.similarity_service import SimilarityInput, build_similarity_groups
from app.services.task_status import set_task_status


router = APIRouter(tags=["similarity"])
logger = logging.getLogger(__name__)


@router.post("/api/projects/{project_id}/similar-groups/build")
def build_project_similar_groups(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(db, project_id)
    settings = get_settings(db)
    threshold = get_int_setting(settings, "similarityThreshold", 8)
    set_task_status(
        project_id,
        "similarity",
        "running",
        progress=0,
        message="正在读取照片并计算相似度",
    )
    photos = (
        db.query(Photo)
        .filter(Photo.project_id == project_id)
        .order_by(Photo.id.asc())
        .all()
    )
    for old_group in db.query(SimilarGroup).filter(SimilarGroup.project_id == project_id).all():
        db.delete(old_group)
    db.flush()

    built = build_similarity_groups(
        [
            SimilarityInput(
                id=photo.id,
                file_path=photo.file_path,
                total_score=photo.total_score,
                blur_score=photo.blur_score,
                width=photo.width,
                height=photo.height,
            )
            for photo in photos
        ],
        threshold=threshold,
    )
    set_task_status(
        project_id,
        "similarity",
        "running",
        progress=0.75,
        message="正在写入相似照片分组",
    )
    for photo in photos:
        photo.perceptual_hash = built["hashes"].get(photo.id)

    grouped_photo_count = 0
    for group_data in built["groups"]:
        group = SimilarGroup(
            project_id=project_id,
            recommended_photo_id=group_data["recommended_photo_id"],
        )
        db.add(group)
        db.flush()
        grouped_photo_count += len(group_data["members"])
        for member in group_data["members"]:
            db.add(
                PhotoSimilarity(
                    group_id=group.id,
                    photo_id=member["photo_id"],
                    similarity_score=member["similarity_score"],
                )
            )
    db.commit()
    result = SimilarBuildResult(
        project_id=project_id,
        group_count=len(built["groups"]),
        grouped_photo_count=grouped_photo_count,
    )
    set_task_status(
        project_id,
        "similarity",
        "completed",
        progress=1,
        message="相似聚类完成",
        result=result.model_dump(),
    )
    logger.info("项目 %s 相似聚类完成：阈值 %s，生成 %s 组", project_id, threshold, len(built["groups"]))
    return ok(result.model_dump(), "相似照片组已生成")


@router.get("/api/projects/{project_id}/similar-groups")
def list_project_similar_groups(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(db, project_id)
    groups = (
        db.query(SimilarGroup)
        .filter(SimilarGroup.project_id == project_id)
        .order_by(SimilarGroup.id.asc())
        .all()
    )
    return ok([_serialize_group(db, group).model_dump() for group in groups])


@router.patch("/api/similar-groups/{group_id}/recommended-photo")
def update_recommended_photo(
    group_id: int,
    payload: RecommendedPhotoUpdate,
    db: Session = Depends(get_db),
):
    group = db.query(SimilarGroup).filter(SimilarGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="相似组不存在")
    exists = (
        db.query(PhotoSimilarity)
        .filter(
            PhotoSimilarity.group_id == group_id,
            PhotoSimilarity.photo_id == payload.recommended_photo_id,
        )
        .first()
    )
    if not exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="推荐图必须属于当前相似组")
    group.recommended_photo_id = payload.recommended_photo_id
    db.commit()
    db.refresh(group)
    return ok(_serialize_group(db, group).model_dump(), "相似组推荐图已更新")


@router.post("/api/similar-groups/{group_id}/apply-recommendation")
def apply_group_recommendation(group_id: int, db: Session = Depends(get_db)):
    group = db.query(SimilarGroup).filter(SimilarGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="相似组不存在")
    updated = 0
    for item in group.photos:
        if item.photo_id == group.recommended_photo_id:
            item.photo.status = "keep"
        elif item.photo.status == "pending":
            item.photo.status = "candidate"
        updated += 1
    db.commit()
    return ok({"group_id": group_id, "updated_count": updated}, "已按推荐图处理相似组")


@router.post("/api/similar-groups/{group_id}/reject-others")
def reject_group_non_recommended(group_id: int, db: Session = Depends(get_db)):
    group = db.query(SimilarGroup).filter(SimilarGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="相似组不存在")
    updated = 0
    for item in group.photos:
        if item.photo_id == group.recommended_photo_id:
            item.photo.status = "keep"
        else:
            item.photo.status = "reject"
        updated += 1
    db.commit()
    return ok({"group_id": group_id, "updated_count": updated}, "已保留推荐图并淘汰其余相似照片")


def _serialize_group(db: Session, group: SimilarGroup) -> SimilarGroupOut:
    photos = []
    for item in sorted(group.photos, key=lambda entry: entry.photo_id):
        photos.append(
            SimilarPhotoOut(
                photo=serialize_photo(db, item.photo),
                similarity_score=item.similarity_score,
                is_recommended=item.photo_id == group.recommended_photo_id,
            )
        )
    return SimilarGroupOut(
        id=group.id,
        project_id=group.project_id,
        recommended_photo_id=group.recommended_photo_id,
        created_at=group.created_at,
        photos=photos,
    )

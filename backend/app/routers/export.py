import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ExportRecord
from app.routers.common import get_project_or_404, ok
from app.schemas import ExportRecordOut, ExportRequest, ExportResult
from app.services.export_service import export_project_assets
from app.services.task_status import set_task_status


router = APIRouter(prefix="/api/projects", tags=["export"])
direct_router = APIRouter(prefix="/api/export", tags=["export"])
logger = logging.getLogger(__name__)


@router.post("/{project_id}/export")
def export_project(
    project_id: int,
    payload: ExportRequest | None = None,
    db: Session = Depends(get_db),
):
    project = get_project_or_404(db, project_id)
    payload = payload or ExportRequest()
    set_task_status(
        project_id,
        "export",
        "running",
        progress=0,
        message="正在准备导出任务",
    )
    result = export_project_assets(
        db,
        project,
        export_dir=payload.export_dir,
        export_range=payload.export_range,
        include_excel=payload.include_excel,
    )
    set_task_status(
        project_id,
        "export",
        "completed",
        progress=1,
        message="导出完成",
        result=result,
    )
    logger.info("项目 %s 导出完成：复制 %s 张，目录 %s", project_id, result["copied_count"], result["export_dir"])
    return ok(ExportResult(**result).model_dump(), "导出完成")


@router.get("/{project_id}/exports")
def list_project_exports(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(db, project_id)
    exports = (
        db.query(ExportRecord)
        .filter(ExportRecord.project_id == project_id)
        .order_by(ExportRecord.export_time.desc())
        .all()
    )
    return ok([ExportRecordOut.model_validate(item).model_dump() for item in exports])


@direct_router.post("/images")
def export_images(payload: ExportRequest, db: Session = Depends(get_db)):
    if payload.project_id is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少 project_id")
    payload.include_excel = False
    return export_project(payload.project_id, payload, db)


@direct_router.post("/report")
def export_report(payload: ExportRequest, db: Session = Depends(get_db)):
    if payload.project_id is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少 project_id")
    payload.include_excel = True
    return export_project(payload.project_id, payload, db)

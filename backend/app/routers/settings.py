from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.common import ok
from app.schemas import AppSettingsOut, SettingsUpdate
from app.services.settings_service import get_settings, update_settings


router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def read_settings(db: Session = Depends(get_db)):
    return ok(AppSettingsOut(values=get_settings(db)).model_dump())


@router.patch("")
def patch_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    return ok(AppSettingsOut(values=update_settings(db, payload.values)).model_dump(), "设置已保存")


@router.post("")
def post_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    return patch_settings(payload, db)

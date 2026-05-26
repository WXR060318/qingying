import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.services.runtime_paths import get_config_path


logger = logging.getLogger(__name__)

DEFAULT_SETTINGS: dict[str, Any] = {
    "defaultImportDir": "",
    "defaultExportDir": "",
    "blurThreshold": "80",
    "exposureThreshold": "55",
    "similarityThreshold": "8",
    "enableVisionModel": "false",
    "visionProvider": "openai",
    "visionModel": "gpt-4o-mini",
    "visionApiBase": "https://api.openai.com/v1",
    "visionApiKey": "",
    "backendPort": "8765",
    "recentProjects": "[]",
}

LEGACY_TO_CANONICAL = {
    "vision.enabled": "enableVisionModel",
    "vision.provider": "visionProvider",
    "vision.model": "visionModel",
    "vision.api_key": "visionApiKey",
    "vision.base_url": "visionApiBase",
    "export.default_dir": "defaultExportDir",
    "import.default_dir": "defaultImportDir",
    "quality.blur_threshold": "blurThreshold",
    "quality.exposure_threshold": "exposureThreshold",
    "similarity.threshold": "similarityThreshold",
}

CANONICAL_TO_LEGACY = {
    "enableVisionModel": "vision.enabled",
    "visionProvider": "vision.provider",
    "visionModel": "vision.model",
    "visionApiKey": "vision.api_key",
    "visionApiBase": "vision.base_url",
    "defaultExportDir": "export.default_dir",
    "defaultImportDir": "import.default_dir",
    "blurThreshold": "quality.blur_threshold",
    "exposureThreshold": "quality.exposure_threshold",
    "similarityThreshold": "similarity.threshold",
}


def ensure_settings_file() -> dict[str, Any]:
    config_path = get_config_path()
    values: dict[str, Any] = {}
    if config_path.exists():
        try:
            loaded = json.loads(config_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                values.update(loaded)
        except json.JSONDecodeError:
            logger.exception("配置文件不是合法 JSON，将使用默认配置重建")

    normalized = _normalize_values(values)
    changed = normalized != values or not config_path.exists()
    if changed:
        config_path.write_text(
            json.dumps(normalized, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return normalized


def get_settings(db: Session | None = None) -> dict[str, Any]:
    return _with_legacy_aliases(ensure_settings_file())


def update_settings(db: Session | None, values: dict[str, Any]) -> dict[str, Any]:
    current = ensure_settings_file()
    for key, value in values.items():
        canonical_key = LEGACY_TO_CANONICAL.get(key, key)
        if canonical_key not in DEFAULT_SETTINGS and canonical_key not in current:
            current[canonical_key] = value
        else:
            current[canonical_key] = _string_or_none(value)

    current = _normalize_values(current)
    get_config_path().write_text(
        json.dumps(current, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("设置已保存到 %s", get_config_path())
    return _with_legacy_aliases(current)


def setting_is_true(value: Any) -> bool:
    return str(value).lower() in {"1", "true", "yes", "on", "启用"}


def get_float_setting(settings: dict[str, Any], key: str, default: float) -> float:
    try:
        return float(settings.get(key, default))
    except (TypeError, ValueError):
        return default


def get_int_setting(settings: dict[str, Any], key: str, default: int) -> int:
    try:
        return int(float(settings.get(key, default)))
    except (TypeError, ValueError):
        return default


def _normalize_values(values: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(DEFAULT_SETTINGS)
    for key, value in values.items():
        normalized[LEGACY_TO_CANONICAL.get(key, key)] = _string_or_none(value)
    return normalized


def _with_legacy_aliases(values: dict[str, Any]) -> dict[str, Any]:
    merged = dict(values)
    for canonical, legacy in CANONICAL_TO_LEGACY.items():
        merged[legacy] = values.get(canonical)
    return merged


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)

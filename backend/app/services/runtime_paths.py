import os
import sys
from pathlib import Path


APP_NAME = os.getenv("QINGYING_APP_NAME", "青影智筛")


def get_user_data_dir() -> Path:
    configured = os.getenv("QINGYING_USER_DATA_DIR")
    if configured:
        return _ensure_dir(Path(configured).expanduser())

    if sys.platform == "darwin":
        return _ensure_dir(Path.home() / "Library" / "Application Support" / APP_NAME)
    if sys.platform == "win32":
        base = os.getenv("APPDATA")
        root = Path(base) if base else Path.home() / "AppData" / "Roaming"
        return _ensure_dir(root / APP_NAME)

    base = os.getenv("XDG_CONFIG_HOME")
    root = Path(base) if base else Path.home() / ".config"
    return _ensure_dir(root / APP_NAME)


def get_storage_dir() -> Path:
    configured = os.getenv("QINGYING_STORAGE_DIR")
    if configured:
        return _ensure_dir(Path(configured).expanduser())
    return _ensure_dir(get_user_data_dir() / "storage")


def get_logs_dir() -> Path:
    return _ensure_dir(get_user_data_dir() / "logs")


def get_config_path() -> Path:
    return get_user_data_dir() / "config.json"


def resource_path(relative_path: str) -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        return Path(bundle_root) / relative_path
    return Path(__file__).resolve().parents[3] / relative_path


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path

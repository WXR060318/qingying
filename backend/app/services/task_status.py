from datetime import datetime
from typing import Any


_STATUS: dict[int, dict[str, dict[str, Any]]] = {}


def set_task_status(project_id: int, task: str, status: str, **extra: Any) -> None:
    project_status = _STATUS.setdefault(project_id, {})
    project_status[task] = {
        "status": status,
        "updated_at": datetime.utcnow().isoformat(),
        **extra,
    }


def get_project_status(project_id: int) -> dict[str, Any]:
    return _STATUS.get(project_id, {})

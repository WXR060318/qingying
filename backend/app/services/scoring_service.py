from typing import Any

from app.services.image_quality_service import suggest_status


def compute_auto_score(image_data: dict[str, Any]) -> tuple[float, str]:
    """Compatibility wrapper for first-version code paths."""
    score = image_data.get("total_score")
    if score is None:
        parts = [
            image_data.get("blur_score"),
            image_data.get("exposure_score"),
            image_data.get("resolution_score"),
            image_data.get("composition_score"),
        ]
        if all(part is not None for part in parts):
            # Same weights as the second-version local analysis formula.
            score = (
                float(parts[0]) * 0.35
                + float(parts[1]) * 0.25
                + float(parts[2]) * 0.20
                + float(parts[3]) * 0.20
            )
        else:
            score = 0.0
    score = max(0.0, min(100.0, round(float(score), 1)))
    return score, suggest_status(score)

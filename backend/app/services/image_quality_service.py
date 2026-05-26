import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import ExifTags, Image, ImageFile


ImageFile.LOAD_TRUNCATED_IMAGES = True

LOW_RESOLUTION_MIN_WIDTH = 1280
LOW_RESOLUTION_MIN_HEIGHT = 720
BLURRY_RAW_THRESHOLD = 80.0
UNDEREXPOSED_MEAN = 55.0
OVEREXPOSED_MEAN = 205.0

ISSUE_FILE_DAMAGED = "文件损坏"
ISSUE_BLURRY = "模糊"
ISSUE_OVEREXPOSED = "过曝"
ISSUE_UNDEREXPOSED = "欠曝"
ISSUE_LOW_RESOLUTION = "分辨率低"
ISSUE_COMPOSITION = "构图待检查"

LEGACY_FLAG_MAP = {
    "unreadable": ISSUE_FILE_DAMAGED,
    "blurry": ISSUE_BLURRY,
    "too_dark": ISSUE_UNDEREXPOSED,
    "too_bright": ISSUE_OVEREXPOSED,
    "low_resolution": ISSUE_LOW_RESOLUTION,
}


def _read_image_bgr(path: Path) -> np.ndarray | None:
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
        if data.size == 0:
            return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception:
        return None


def read_basic_metadata(file_path: str) -> dict[str, Any]:
    path = Path(file_path)
    file_size = path.stat().st_size if path.exists() else None
    width: int | None = None
    height: int | None = None
    image_format: str | None = None
    exif_datetime: str | None = None

    try:
        with Image.open(path) as image:
            width, height = image.size
            image_format = image.format.lower() if image.format else path.suffix.lstrip(".").lower()
            exif_datetime = _read_exif_datetime(image)
    except Exception:
        image_format = path.suffix.lstrip(".").lower() or None

    return {
        "width": width,
        "height": height,
        "file_size": file_size,
        "image_format": image_format,
        "exif_datetime": exif_datetime,
    }


def create_thumbnail(file_path: str, thumbnail_path: Path, max_side: int = 400) -> str | None:
    if thumbnail_path.exists():
        return str(thumbnail_path)
    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(file_path) as image:
            image.thumbnail((max_side, max_side))
            image.convert("RGB").save(thumbnail_path, "JPEG", quality=86, optimize=True)
        return str(thumbnail_path)
    except Exception:
        return None


def analyze_image_quality(
    file_path: str,
    blur_threshold: float = BLURRY_RAW_THRESHOLD,
    exposure_threshold: float = UNDEREXPOSED_MEAN,
) -> dict[str, Any]:
    path = Path(file_path)
    metadata = read_basic_metadata(file_path)
    width = metadata["width"]
    height = metadata["height"]
    issue_tags: list[str] = []

    image = _read_image_bgr(path)
    if image is None:
        return {
            **metadata,
            "blur_score": None,
            "exposure_score": None,
            "resolution_score": _resolution_score(width, height),
            "composition_score": None,
            "total_score": None,
            "issue_tags": [ISSUE_FILE_DAMAGED],
            "status": "pending",
        }

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    raw_blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    blur_score = _blur_score(raw_blur)
    exposure_score, exposure_issue = _exposure_score(gray, exposure_threshold)
    resolution_score = _resolution_score(width, height)
    composition_score, composition_issue = _composition_score(gray)

    if raw_blur < blur_threshold:
        issue_tags.append(ISSUE_BLURRY)
    if exposure_issue:
        issue_tags.append(exposure_issue)
    if resolution_score < 60:
        issue_tags.append(ISSUE_LOW_RESOLUTION)
    if composition_issue:
        issue_tags.append(composition_issue)

    # 综合评分采用第二版建议权重：
    # 清晰度 35% + 曝光 25% + 分辨率 20% + 构图 20%。
    total_score = round(
        blur_score * 0.35
        + exposure_score * 0.25
        + resolution_score * 0.20
        + composition_score * 0.20,
        1,
    )

    return {
        **metadata,
        "blur_score": round(blur_score, 1),
        "exposure_score": round(exposure_score, 1),
        "resolution_score": round(resolution_score, 1),
        "composition_score": round(composition_score, 1),
        "total_score": total_score,
        "issue_tags": issue_tags,
        "status": suggest_status(total_score),
    }


def suggest_status(total_score: float | None) -> str:
    if total_score is None:
        return "pending"
    if total_score >= 80:
        return "keep"
    if total_score >= 60:
        return "candidate"
    return "reject"


def encode_tags(tags: list[str]) -> str:
    return json.dumps(tags, ensure_ascii=False)


def decode_tags(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        decoded = json.loads(value)
        if isinstance(decoded, list):
            return [LEGACY_FLAG_MAP.get(str(item), str(item)) for item in decoded]
    except json.JSONDecodeError:
        pass
    return []


encode_flags = encode_tags
decode_flags = decode_tags


def _read_exif_datetime(image: Image.Image) -> str | None:
    try:
        exif = image.getexif()
    except Exception:
        return None
    if not exif:
        return None
    tag_map = {ExifTags.TAGS.get(key, key): value for key, value in exif.items()}
    value = tag_map.get("DateTimeOriginal") or tag_map.get("DateTime")
    return str(value) if value else None


def _blur_score(raw_blur: float) -> float:
    if raw_blur <= 0:
        return 0.0
    # Laplacian variance has a long tail; square-root scaling keeps the score usable.
    return max(0.0, min(100.0, (raw_blur**0.5) * 7.5))


def _exposure_score(gray: np.ndarray, exposure_threshold: float = UNDEREXPOSED_MEAN) -> tuple[float, str | None]:
    mean = float(gray.mean())
    too_dark_ratio = float(np.mean(gray < 25))
    too_bright_ratio = float(np.mean(gray > 245))
    issue: str | None = None
    score = 100.0

    underexposed_mean = exposure_threshold
    overexposed_mean = max(underexposed_mean + 40.0, 255.0 - exposure_threshold)

    if mean < underexposed_mean:
        issue = ISSUE_UNDEREXPOSED
        score -= min(55.0, (underexposed_mean - mean) * 1.1)
    elif mean > overexposed_mean:
        issue = ISSUE_OVEREXPOSED
        score -= min(55.0, (mean - overexposed_mean) * 1.1)

    score -= min(30.0, too_dark_ratio * 100)
    score -= min(30.0, too_bright_ratio * 100)
    return max(0.0, min(100.0, score)), issue


def _resolution_score(width: int | None, height: int | None) -> float:
    if not width or not height:
        return 0.0
    if width < LOW_RESOLUTION_MIN_WIDTH or height < LOW_RESOLUTION_MIN_HEIGHT:
        return 45.0
    pixels = width * height
    if pixels >= 12_000_000:
        return 100.0
    if pixels >= 6_000_000:
        return 90.0
    if pixels >= 2_000_000:
        return 78.0
    return 62.0


def _composition_score(gray: np.ndarray) -> tuple[float, str | None]:
    height, width = gray.shape[:2]
    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.mean(edges > 0))

    y1, y2 = int(height * 0.25), int(height * 0.75)
    x1, x2 = int(width * 0.25), int(width * 0.75)
    center = gray[y1:y2, x1:x2]
    center_brightness = float(center.mean()) if center.size else float(gray.mean())
    center_std = float(center.std()) if center.size else float(gray.std())

    score = 78.0
    issue = None
    if center_brightness < 45:
        score -= 22
        issue = ISSUE_COMPOSITION
    if edge_density < 0.015:
        score -= 24
        issue = ISSUE_COMPOSITION
    elif edge_density > 0.12:
        score -= 8
    else:
        score += 8
    if center_std < 22:
        score -= 14
        issue = ISSUE_COMPOSITION
    else:
        score += 6

    return max(0.0, min(100.0, score)), issue

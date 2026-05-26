from dataclasses import dataclass
from pathlib import Path
from typing import Any

import imagehash
from PIL import Image, ImageFile


ImageFile.LOAD_TRUNCATED_IMAGES = True
HASH_BITS = 64


@dataclass
class SimilarityInput:
    id: int
    file_path: str
    total_score: float | None = None
    blur_score: float | None = None
    width: int | None = None
    height: int | None = None


def calculate_phash(file_path: str) -> str | None:
    try:
        with Image.open(file_path) as image:
            return str(imagehash.phash(image.convert("RGB")))
    except Exception:
        return None


def hash_distance(hash_a: str | None, hash_b: str | None) -> int | None:
    if not hash_a or not hash_b:
        return None
    try:
        return imagehash.hex_to_hash(hash_a) - imagehash.hex_to_hash(hash_b)
    except Exception:
        return None


def similarity_score_from_distance(distance: int | None) -> float | None:
    if distance is None:
        return None
    return round(max(0.0, min(1.0, 1 - distance / HASH_BITS)), 4)


def build_similarity_groups(
    photos: list[SimilarityInput],
    threshold: int = 8,
) -> dict[str, Any]:
    hashes = {photo.id: calculate_phash(photo.file_path) for photo in photos}
    parent = {photo.id: photo.id for photo in photos if hashes.get(photo.id)}
    distances: dict[tuple[int, int], int] = {}

    def find(photo_id: int) -> int:
        while parent[photo_id] != photo_id:
            parent[photo_id] = parent[parent[photo_id]]
            photo_id = parent[photo_id]
        return photo_id

    def union(left: int, right: int) -> None:
        root_left = find(left)
        root_right = find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    valid_ids = list(parent.keys())
    for index, photo_id in enumerate(valid_ids):
        for candidate_id in valid_ids[index + 1 :]:
            distance = hash_distance(hashes[photo_id], hashes[candidate_id])
            if distance is None:
                continue
            distances[(photo_id, candidate_id)] = distance
            distances[(candidate_id, photo_id)] = distance
            if distance <= threshold:
                union(photo_id, candidate_id)

    grouped: dict[int, list[int]] = {}
    for photo_id in valid_ids:
        grouped.setdefault(find(photo_id), []).append(photo_id)

    photo_by_id = {photo.id: photo for photo in photos}
    groups: list[dict[str, Any]] = []
    for member_ids in grouped.values():
        if len(member_ids) < 2:
            continue
        recommended_id = max(member_ids, key=lambda item: _quality_rank(photo_by_id[item]))
        members = []
        for member_id in member_ids:
            if member_id == recommended_id:
                score = 1.0
            else:
                score = similarity_score_from_distance(distances.get((recommended_id, member_id)))
            members.append({"photo_id": member_id, "similarity_score": score})
        groups.append(
            {
                "recommended_photo_id": recommended_id,
                "photo_ids": member_ids,
                "members": members,
            }
        )

    return {
        "hashes": hashes,
        "groups": groups,
    }


def assign_similarity_groups(
    images: list[SimilarityInput],
    threshold: int = 8,
) -> dict[int, dict[str, Any]]:
    """Compatibility helper matching the first-version return shape."""
    built = build_similarity_groups(images, threshold=threshold)
    result: dict[int, dict[str, Any]] = {
        image.id: {
            "image_hash": built["hashes"].get(image.id),
            "similarity_group_id": None,
            "is_duplicate_candidate": False,
            "is_best_in_group": False,
        }
        for image in images
    }
    for group_index, group in enumerate(built["groups"], start=1):
        for photo_id in group["photo_ids"]:
            result[photo_id].update(
                {
                    "similarity_group_id": group_index,
                    "is_duplicate_candidate": photo_id != group["recommended_photo_id"],
                    "is_best_in_group": photo_id == group["recommended_photo_id"],
                }
            )
    return result


def _quality_rank(photo: SimilarityInput) -> tuple[float, float, int, int]:
    area = (photo.width or 0) * (photo.height or 0)
    file_exists = 1 if Path(photo.file_path).exists() else 0
    return (photo.total_score or 0.0, photo.blur_score or 0.0, area, file_exists)

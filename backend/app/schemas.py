from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


EVENT_TYPES = [
    "会议",
    "讲座",
    "志愿服务",
    "校园文化活动",
    "文体活动",
    "颁奖表彰",
    "集体合影",
    "新闻采访",
    "其他",
]

SCENE_TYPES = [
    "会议全景",
    "嘉宾发言",
    "主持环节",
    "观众互动",
    "活动特写",
    "志愿服务",
    "颁奖表彰",
    "集体合影",
    "新闻采访",
    "宣传优选",
    "待人工确认",
]

RECOMMENDED_USAGES = [
    "新闻稿头图",
    "新闻稿正文配图",
    "推文封面候选",
    "活动归档",
    "部门素材留存",
    "不建议使用",
]


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str = ""


PhotoStatus = Literal["keep", "candidate", "reject", "pending"]
ExportRange = Literal["keep_only", "keep_candidate", "reject_only", "recommended_only", "all"]


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    event_type: str | None = None
    event_date: str | None = None
    location: str | None = None
    photographer: str | None = None
    source_path: str | None = None
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    event_type: str | None = None
    event_date: str | None = None
    location: str | None = None
    photographer: str | None = None
    source_path: str | None = None
    description: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    event_type: str | None = None
    event_date: str | None = None
    location: str | None = None
    photographer: str | None = None
    source_path: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    photo_count: int = 0
    image_count: int = 0


class ScanRequest(BaseModel):
    folder_path: str | None = None


class FolderImportRequest(BaseModel):
    project_id: int | None = None
    folder_path: str
    project_name: str | None = None


class ScanResult(BaseModel):
    project_id: int
    source_path: str
    scanned_count: int
    imported_count: int
    updated_count: int
    skipped_count: int
    failed_count: int
    errors: list[str] = []


ImportRequest = ScanRequest
ImportResult = ScanResult


class LocalAnalyzeResult(BaseModel):
    project_id: int
    analyzed_count: int
    failed_count: int


class ProjectActionRequest(BaseModel):
    project_id: int


class SimilarBuildResult(BaseModel):
    project_id: int
    group_count: int
    grouped_photo_count: int


class VisionAnalyzeRequest(BaseModel):
    photo_ids: list[int] | None = None
    limit: int | None = Field(default=None, ge=1, le=500)


class VisionAnalyzeResult(BaseModel):
    project_id: int
    provider: str
    analyzed_count: int
    failed_count: int
    fallback_to_local: bool
    errors: list[str] = []


AnalyzeResult = LocalAnalyzeResult


class AIAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    photo_id: int
    provider: str
    scene_type: str | None = None
    description: str | None = None
    recommended_usage: str | None = None
    reason: str | None = None
    tags: list[str] = []
    confidence: float | None = None
    raw_response: str | None = None
    created_at: datetime


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    file_name: str
    file_path: str
    thumbnail_path: str | None = None
    file_size: int | None = None
    width: int | None = None
    height: int | None = None
    image_format: str | None = None
    exif_datetime: str | None = None
    blur_score: float | None = None
    exposure_score: float | None = None
    resolution_score: float | None = None
    composition_score: float | None = None
    total_score: float | None = None
    issue_tags: list[str] = []
    perceptual_hash: str | None = None
    ai_category: str | None = None
    user_category: str | None = None
    recommended_usage: str | None = None
    status: PhotoStatus = "pending"
    notes: str | None = None
    is_similar_recommended: bool = False
    similar_group_id: int | None = None
    latest_ai_analysis: AIAnalysisOut | None = None
    created_at: datetime
    updated_at: datetime

    # First-version compatibility fields consumed by the existing renderer.
    quality_flags: list[str] = []
    image_hash: str | None = None
    similarity_group_id: int | None = None
    is_duplicate_candidate: bool = False
    is_best_in_group: bool = False
    auto_score: float | None = None
    suggest_status: str = "review"
    manual_status: str = "pending"
    brightness_score: float | None = None
    exposure_status: str | None = None
    resolution_status: str | None = None


ImageOut = PhotoOut


class PhotoUpdate(BaseModel):
    status: PhotoStatus | None = None
    user_category: str | None = None
    recommended_usage: str | None = None
    notes: str | None = None


class ReviewUpdateRequest(PhotoUpdate):
    photo_id: int


class ManualStatusUpdate(BaseModel):
    manual_status: str


class PhotoQuery(BaseModel):
    status: str | None = None
    category: str | None = None
    issue_tag: str | None = None
    search: str | None = None
    sort: str | None = None


class SimilarPhotoOut(BaseModel):
    photo: PhotoOut
    similarity_score: float | None = None
    is_recommended: bool = False


class SimilarGroupOut(BaseModel):
    id: int
    project_id: int
    recommended_photo_id: int | None = None
    created_at: datetime
    photos: list[SimilarPhotoOut]


class RecommendedPhotoUpdate(BaseModel):
    recommended_photo_id: int


class ExportRequest(BaseModel):
    project_id: int | None = None
    export_dir: str | None = None
    export_range: ExportRange = "keep_candidate"
    include_excel: bool = True


class ExportResult(BaseModel):
    project_id: int
    export_dir: str
    report_path: str | None = None
    keep_count: int
    candidate_count: int
    reject_count: int
    pending_count: int = 0
    copied_count: int = 0
    skipped_missing_count: int = 0
    errors: list[str] = []
    # First-version compatibility names.
    accepted_count: int = 0
    review_count: int = 0
    rejected_count: int = 0


class ExportRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    export_path: str
    export_time: datetime
    keep_count: int
    candidate_count: int
    reject_count: int
    report_path: str | None = None


class SettingsUpdate(BaseModel):
    values: dict[str, Any]


class AppSettingsOut(BaseModel):
    values: dict[str, Any]


class AIAnalyzeImageRequest(BaseModel):
    photo_id: int | None = None
    file_path: str | None = None


class AnalysisStatusOut(BaseModel):
    project_id: int
    scan: dict[str, Any] | None = None
    local_analysis: dict[str, Any] | None = None
    vision_analysis: dict[str, Any] | None = None
    similarity: dict[str, Any] | None = None
    export: dict[str, Any] | None = None

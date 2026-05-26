export type PhotoStatus = "keep" | "candidate" | "reject" | "pending";
export type ManualStatus = "pending" | "accepted" | "rejected" | "selected";
export type SuggestStatus = "keep" | "review" | "reject";
export type FilterMode = PhotoStatus | "all";
export type SortMode = "score_desc" | "score_asc" | "blur_desc" | "exposure_desc";
export type ViewMode = "dashboard" | "import" | "analysis" | "review" | "similar" | "settings" | "export";
export type ExportRange = "keep_only" | "keep_candidate" | "reject_only" | "recommended_only" | "all";

export interface Project {
  id: number;
  name: string;
  event_type?: string | null;
  event_date?: string | null;
  location?: string | null;
  photographer?: string | null;
  source_path?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  image_count: number;
}

export interface ProjectCreatePayload {
  name: string;
  event_type?: string | null;
  event_date?: string | null;
  location?: string | null;
  photographer?: string | null;
  source_path?: string | null;
  description?: string | null;
}

export interface AIAnalysis {
  id: number;
  photo_id: number;
  provider: string;
  scene_type?: string | null;
  description?: string | null;
  recommended_usage?: string | null;
  reason?: string | null;
  tags: string[];
  confidence?: number | null;
  raw_response?: string | null;
  created_at: string;
}

export interface PhotoRecord {
  id: number;
  project_id: number;
  file_name: string;
  file_path: string;
  thumbnail_path?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  image_format?: string | null;
  exif_datetime?: string | null;
  blur_score?: number | null;
  exposure_score?: number | null;
  resolution_score?: number | null;
  composition_score?: number | null;
  total_score?: number | null;
  issue_tags: string[];
  perceptual_hash?: string | null;
  ai_category?: string | null;
  user_category?: string | null;
  recommended_usage?: string | null;
  status: PhotoStatus;
  notes?: string | null;
  is_similar_recommended: boolean;
  similar_group_id?: number | null;
  latest_ai_analysis?: AIAnalysis | null;
  created_at: string;
  updated_at: string;

  quality_flags: string[];
  image_hash?: string | null;
  similarity_group_id?: number | null;
  is_duplicate_candidate: boolean;
  is_best_in_group: boolean;
  auto_score?: number | null;
  suggest_status: SuggestStatus;
  manual_status: ManualStatus;
}

export type ImageRecord = PhotoRecord;

export interface ScanResult {
  project_id: number;
  source_path: string;
  scanned_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  errors: string[];
}

export type ImportResult = ScanResult;

export interface AnalyzeResult {
  project_id: number;
  analyzed_count: number;
  failed_count: number;
}

export interface SimilarBuildResult {
  project_id: number;
  group_count: number;
  grouped_photo_count: number;
}

export interface SimilarPhoto {
  photo: PhotoRecord;
  similarity_score?: number | null;
  is_recommended: boolean;
}

export interface SimilarGroup {
  id: number;
  project_id: number;
  recommended_photo_id?: number | null;
  created_at: string;
  photos: SimilarPhoto[];
}

export interface VisionAnalyzeResult {
  project_id: number;
  provider: string;
  analyzed_count: number;
  failed_count: number;
  fallback_to_local: boolean;
  errors: string[];
}

export interface ExportRequest {
  export_dir?: string | null;
  export_range: ExportRange;
  include_excel: boolean;
}

export interface ExportResult {
  project_id: number;
  export_dir: string;
  report_path?: string | null;
  keep_count: number;
  candidate_count: number;
  reject_count: number;
  pending_count: number;
  copied_count: number;
  skipped_missing_count: number;
  errors: string[];
  accepted_count: number;
  review_count: number;
  rejected_count: number;
}

export interface AppSettings {
  values: Record<string, string | null>;
}

export interface BackendStatus {
  running: boolean;
  url: string;
  port: number;
  pid: number | null;
  mode: "development" | "production";
  error: string | null;
  phase: "idle" | "checking" | "starting" | "waiting" | "ready" | "error";
  message: string;
  progress: number;
}

export interface TaskProgress {
  status: "running" | "completed" | "skipped" | "error" | string;
  progress?: number;
  message?: string;
  updated_at?: string;
  result?: unknown;
}

export interface AnalysisStatus {
  project_id: number;
  scan?: TaskProgress | null;
  local_analysis?: TaskProgress | null;
  vision_analysis?: TaskProgress | null;
  similarity?: TaskProgress | null;
  export?: TaskProgress | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

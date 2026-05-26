import type {
  AnalyzeResult,
  AnalysisStatus,
  ApiResponse,
  AppSettings,
  ExportRequest,
  ExportResult,
  ManualStatus,
  PhotoRecord,
  PhotoStatus,
  Project,
  ProjectCreatePayload,
  ScanResult,
  SimilarBuildResult,
  SimilarGroup,
  SortMode,
  VisionAnalyzeResult,
} from "../types";

const FALLBACK_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8765";

let backendUrlPromise: Promise<string> | null = null;

async function getApiBaseUrl() {
  if (!backendUrlPromise) {
    backendUrlPromise = window.qingying?.getBackendUrl?.().catch(() => FALLBACK_API_BASE_URL)
      ?? Promise.resolve(FALLBACK_API_BASE_URL);
  }
  return backendUrlPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `请求失败：HTTP ${response.status}`);
  }
  return payload.data;
}

export interface PhotoListQuery {
  status?: string;
  category?: string;
  issue_tag?: string;
  search?: string;
  sort?: SortMode;
}

function queryString(query?: PhotoListQuery) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (payload: ProjectCreatePayload) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProject: (projectId: number, payload: Partial<ProjectCreatePayload>) =>
    request<Project>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getProject: (projectId: number) => request<Project>(`/api/projects/${projectId}`),
  deleteProject: (projectId: number) =>
    request<{ id: number }>(`/api/projects/${projectId}`, { method: "DELETE" }),
  listPhotos: (projectId: number, query?: PhotoListQuery) =>
    request<PhotoRecord[]>(`/api/projects/${projectId}/photos${queryString(query)}`),
  listImages: (projectId: number) => request<PhotoRecord[]>(`/api/projects/${projectId}/photos`),
  scanPhotos: (projectId: number, folderPath?: string | null) =>
    request<ScanResult>(`/api/projects/${projectId}/scan`, {
      method: "POST",
      body: JSON.stringify({ folder_path: folderPath }),
    }),
  importImages: (projectId: number, folderPath: string) =>
    request<ScanResult>(`/api/projects/${projectId}/scan`, {
      method: "POST",
      body: JSON.stringify({ folder_path: folderPath }),
    }),
  analyzeProject: (projectId: number) =>
    request<AnalyzeResult>(`/api/projects/${projectId}/analyze/local`, { method: "POST" }),
  getAnalysisStatus: (projectId: number) =>
    request<AnalysisStatus>(`/api/projects/${projectId}/analysis-status`),
  analyzeVision: (projectId: number) =>
    request<VisionAnalyzeResult>(`/api/projects/${projectId}/analyze/vision`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  buildSimilarGroups: (projectId: number) =>
    request<SimilarBuildResult>(`/api/projects/${projectId}/similar-groups/build`, {
      method: "POST",
    }),
  listSimilarGroups: (projectId: number) =>
    request<SimilarGroup[]>(`/api/projects/${projectId}/similar-groups`),
  updateRecommendedPhoto: (groupId: number, photoId: number) =>
    request<SimilarGroup>(`/api/similar-groups/${groupId}/recommended-photo`, {
      method: "PATCH",
      body: JSON.stringify({ recommended_photo_id: photoId }),
    }),
  applySimilarGroupRecommendation: (groupId: number) =>
    request<{ group_id: number; updated_count: number }>(
      `/api/similar-groups/${groupId}/apply-recommendation`,
      { method: "POST" },
    ),
  updatePhoto: (photoId: number, payload: Partial<Pick<PhotoRecord, "status" | "user_category" | "recommended_usage" | "notes">>) =>
    request<PhotoRecord>(`/api/photos/${photoId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateManualStatus: (photoId: number, manualStatus: ManualStatus) =>
    request<PhotoRecord>(`/api/images/${photoId}/manual-status`, {
      method: "PATCH",
      body: JSON.stringify({ manual_status: manualStatus }),
    }),
  updatePhotoStatus: (photoId: number, status: PhotoStatus) =>
    request<PhotoRecord>(`/api/photos/${photoId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  exportProject: (projectId: number, payload?: ExportRequest) =>
    request<ExportResult>(`/api/projects/${projectId}/export`, {
      method: "POST",
      body: JSON.stringify(payload ?? { export_range: "keep_candidate", include_excel: true }),
    }),
  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (values: Record<string, string | null>) =>
    request<AppSettings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ values }),
    }),
  thumbnailUrl: (photoId: number) =>
    `${window.__QINGYING_BACKEND_URL__ ?? FALLBACK_API_BASE_URL}/api/photos/${photoId}/thumbnail`,
  photoFileUrl: (photoId: number) =>
    `${window.__QINGYING_BACKEND_URL__ ?? FALLBACK_API_BASE_URL}/api/photos/${photoId}/file`,
};

void getApiBaseUrl().then((url) => {
  window.__QINGYING_BACKEND_URL__ = url;
});

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { DashboardPanel } from "../components/DashboardPanel";
import { DetailPanel } from "../components/DetailPanel";
import { ExportPanel } from "../components/ExportPanel";
import { FilterPanel } from "../components/FilterPanel";
import { ImageGrid } from "../components/ImageGrid";
import { ImportPanel } from "../components/ImportPanel";
import { OperationProgress } from "../components/OperationProgress";
import { PreviewModal } from "../components/PreviewModal";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { SettingsPanel } from "../components/SettingsPanel";
import { SimilarGroupsPanel } from "../components/SimilarGroupsPanel";
import { StartupOverlay } from "../components/StartupOverlay";
import { Toolbar } from "../components/Toolbar";
import type {
  AnalysisStatus,
  AppSettings,
  BackendStatus,
  ExportRange,
  ExportResult,
  FilterMode,
  PhotoRecord,
  PhotoStatus,
  Project,
  ProjectCreatePayload,
  ScanResult,
  SimilarGroup,
  SortMode,
  TaskProgress,
  ViewMode,
} from "../types";

interface Notice {
  type: "success" | "error" | "info";
  message: string;
}

const busyLabels: Record<string, string> = {
  projects: "正在加载项目",
  photos: "正在加载图片",
  scan: "正在扫描照片",
  analyze: "正在进行本地分析",
  vision: "正在进行大模型分析",
  similar: "正在生成相似组",
  export: "正在导出结果",
  status: "正在保存复核状态",
  settings: "正在保存设置",
};

type OperationTaskKey =
  | "scan"
  | "local_analysis"
  | "vision_analysis"
  | "similarity"
  | "export"
  | "status"
  | "settings";

interface ActiveOperation {
  key: OperationTaskKey;
  label: string;
}

export function WorkspacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [previewPhotoId, setPreviewPhotoId] = useState<number | null>(null);
  const [similarGroups, setSimilarGroups] = useState<SimilarGroup[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [statusFilter, setStatusFilter] = useState<FilterMode>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [issueTagFilter, setIssueTagFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("score_desc");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | null>(null);
  const [operationProgress, setOperationProgress] = useState<TaskProgress | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [photos, selectedPhotoId],
  );
  const previewPhoto = useMemo(
    () => photos.find((photo) => photo.id === previewPhotoId) ?? null,
    [photos, previewPhotoId],
  );

  const loadProjects = useCallback(async (preferredProjectId?: number | null) => {
    setBusy((current) => current ?? "projects");
    try {
      const data = await api.listProjects();
      setProjects(data);
      setSelectedProjectId((current) => {
        if (preferredProjectId && data.some((project) => project.id === preferredProjectId)) {
          return preferredProjectId;
        }
        if (current && data.some((project) => project.id === current)) return current;
        return data[0]?.id ?? null;
      });
    } catch (error) {
      showError(error);
    } finally {
      setBusy((current) => (current === "projects" ? null : current));
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    if (!selectedProjectId) return;
    setBusy((current) => current ?? "photos");
    try {
      const data = await api.listPhotos(selectedProjectId, {
        status: statusFilter,
        category: categoryFilter,
        issue_tag: issueTagFilter,
        search,
        sort,
      });
      setPhotos(data);
      setSelectedPhotoId((current) => {
        if (current && data.some((photo) => photo.id === current)) return current;
        return data[0]?.id ?? null;
      });
    } catch (error) {
      showError(error);
    } finally {
      setBusy((current) => (current === "photos" ? null : current));
    }
  }, [categoryFilter, issueTagFilter, search, selectedProjectId, sort, statusFilter]);

  const loadSimilarGroups = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      setSimilarGroups(await api.listSimilarGroups(selectedProjectId));
    } catch (error) {
      showError(error);
    }
  }, [selectedProjectId]);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await api.getSettings());
    } catch (error) {
      showError(error);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadSettings();
  }, [loadProjects, loadSettings]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (window.qingying?.getBackendStatus) {
          const status = await window.qingying.getBackendStatus();
          if (active) setBackendStatus(status);
          return;
        }
        const health = await api.health();
        if (active) {
          setBackendStatus({
            running: health.status === "ok",
            url: window.__QINGYING_BACKEND_URL__ ?? "http://127.0.0.1:8765",
            port: 8765,
            pid: null,
            mode: "development",
            error: null,
            phase: "ready",
            message: "本地后端已连接",
            progress: 100,
          });
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "后端连接失败";
          setBackendStatus({
            running: false,
            url: window.__QINGYING_BACKEND_URL__ ?? "http://127.0.0.1:8765",
            port: 8765,
            pid: null,
            mode: "development",
            error: message,
            phase: "error",
            message,
            progress: 100,
          });
        }
      }
    })();
    const unsubscribe = window.qingying?.onBackendStatus?.((status) => setBackendStatus(status));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setPhotos([]);
      setSelectedPhotoId(null);
      return;
    }
    void loadPhotos();
    void loadSimilarGroups();
  }, [loadPhotos, loadSimilarGroups, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !activeOperation) return;
    let stopped = false;

    async function pollStatus() {
      if (!selectedProjectId || !activeOperation) return;
      try {
        const status = await api.getAnalysisStatus(selectedProjectId);
        if (stopped) return;
        const task = progressFromStatus(status, activeOperation.key);
        if (task) {
          setOperationProgress(task);
        }
      } catch {
        if (!stopped) {
          setOperationProgress((current) => current ?? { status: "running", progress: 0.12, message: "正在处理" });
        }
      }
    }

    void pollStatus();
    const timer = window.setInterval(() => {
      void pollStatus();
    }, 500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeOperation, selectedProjectId]);

  function beginOperation(key: OperationTaskKey, label: string, message = "正在处理") {
    setActiveOperation({ key, label });
    setOperationProgress({ status: "running", progress: 0.08, message });
  }

  function finishOperation(message = "处理完成") {
    setOperationProgress((current) => ({
      ...(current ?? {}),
      status: "completed",
      progress: 1,
      message,
    }));
    window.setTimeout(() => {
      setActiveOperation(null);
      setOperationProgress(null);
    }, 900);
  }

  function failOperation(message = "操作失败") {
    setOperationProgress((current) => ({
      ...(current ?? {}),
      status: "error",
      progress: 1,
      message,
    }));
    window.setTimeout(() => {
      setActiveOperation(null);
      setOperationProgress(null);
    }, 1800);
  }

  async function handleCreateProject(payload: ProjectCreatePayload) {
    try {
      const created = await api.createProject(payload);
      setNotice({ type: "success", message: "项目已创建" });
      await loadProjects(created.id);
      if (payload.source_path) {
        beginOperation("scan", "导入照片", "正在扫描照片文件夹");
        setLastScan(await api.scanPhotos(created.id, payload.source_path));
        await loadProjects(created.id);
        finishOperation("照片导入完成");
      }
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "项目创建失败");
    }
  }

  async function handleDeleteProject(projectId: number) {
    const project = projects.find((item) => item.id === projectId);
    if (!window.confirm(`确定删除项目「${project?.name ?? projectId}」吗？只删除数据库记录，不删除原始照片。`)) {
      return;
    }
    try {
      await api.deleteProject(projectId);
      setNotice({ type: "success", message: "项目记录已删除" });
      await loadProjects(null);
    } catch (error) {
      showError(error);
    }
  }

  async function handleScan() {
    if (!selectedProjectId) return;
    const folderPath = (await pickFolder()) || selectedProject?.source_path || null;
    setBusy("scan");
    beginOperation("scan", "导入照片", "正在扫描照片文件夹");
    try {
      const result = await api.scanPhotos(selectedProjectId, folderPath);
      setLastScan(result);
      setNotice({
        type: result.failed_count ? "info" : "success",
        message: `扫描完成：新增 ${result.imported_count} 张，更新 ${result.updated_count} 张，失败 ${result.failed_count} 张`,
      });
      await loadProjects(selectedProjectId);
      await loadPhotos();
      finishOperation("照片导入完成");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "照片导入失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleAnalyze() {
    if (!selectedProjectId) return;
    setBusy("analyze");
    beginOperation("local_analysis", "本地质量分析", "正在准备本地质量分析");
    try {
      const result = await api.analyzeProject(selectedProjectId);
      setNotice({
        type: "success",
        message: `本地分析完成：${result.analyzed_count} 张，失败 ${result.failed_count} 张`,
      });
      await loadPhotos();
      finishOperation("本地分析完成");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "本地分析失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleVisionAnalyze() {
    if (!selectedProjectId) return;
    setBusy("vision");
    beginOperation("vision_analysis", "大模型分析", "正在准备大模型分析");
    try {
      const result = await api.analyzeVision(selectedProjectId);
      setNotice({
        type: result.fallback_to_local ? "info" : "success",
        message: result.fallback_to_local
          ? `大模型不可用或未启用，已降级。本次成功 ${result.analyzed_count} 张`
          : `大模型分析完成：${result.analyzed_count} 张`,
      });
      await loadPhotos();
      finishOperation(result.fallback_to_local ? "大模型已降级处理" : "大模型分析完成");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "大模型分析失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleBuildSimilar() {
    if (!selectedProjectId) return;
    setBusy("similar");
    beginOperation("similarity", "相似照片聚类", "正在计算相似照片");
    try {
      const result = await api.buildSimilarGroups(selectedProjectId);
      setNotice({
        type: "success",
        message: `相似聚类完成：${result.group_count} 组，${result.grouped_photo_count} 张`,
      });
      await loadPhotos();
      await loadSimilarGroups();
      setView("similar");
      finishOperation("相似聚类完成");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "相似聚类失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleStatusChange(photoId: number, status: PhotoStatus) {
    setBusy("status");
    beginOperation("status", "保存复核状态", "正在保存复核状态");
    try {
      const updated = await api.updatePhotoStatus(photoId, status);
      replacePhoto(updated);
      setNotice({ type: "success", message: "状态已保存" });
      finishOperation("状态已保存");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "保存状态失败");
    } finally {
      setBusy(null);
    }
  }

  async function handlePhotoUpdate(photoId: number, payload: Partial<PhotoRecord>) {
    setBusy("status");
    beginOperation("status", "保存复核信息", "正在保存复核信息");
    try {
      const updated = await api.updatePhoto(photoId, payload);
      replacePhoto(updated);
      setNotice({ type: "success", message: "复核信息已保存" });
      finishOperation("复核信息已保存");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "保存复核信息失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleSetRecommended(groupId: number, photoId: number) {
    beginOperation("status", "保存相似组推荐图", "正在保存相似组推荐图");
    try {
      await api.updateRecommendedPhoto(groupId, photoId);
      await loadSimilarGroups();
      await loadPhotos();
      finishOperation("推荐图已保存");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "保存推荐图失败");
    }
  }

  async function handleApplyRecommendation(groupId: number) {
    beginOperation("status", "处理相似组", "正在应用相似组推荐");
    try {
      const result = await api.applySimilarGroupRecommendation(groupId);
      setNotice({ type: "success", message: `已处理 ${result.updated_count} 张相似照片` });
      await loadPhotos();
      await loadSimilarGroups();
      finishOperation("相似组处理完成");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "处理相似组失败");
    }
  }

  async function handleSaveSettings(values: Record<string, string | null>) {
    setBusy("settings");
    beginOperation("settings", "保存设置", "正在保存本地配置");
    try {
      setSettings(await api.updateSettings(values));
      setNotice({ type: "success", message: "设置已保存" });
      finishOperation("设置已保存");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "保存设置失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleExport(exportDir: string | null, exportRange: ExportRange, includeExcel: boolean) {
    if (!selectedProjectId) return;
    setBusy("export");
    beginOperation("export", "导出结果", "正在准备导出结果");
    try {
      const result = await api.exportProject(selectedProjectId, {
        export_dir: exportDir,
        export_range: exportRange,
        include_excel: includeExcel,
      });
      setLastExport(result);
      setNotice({ type: "success", message: `导出完成：复制 ${result.copied_count} 张` });
      finishOperation("导出完成");
    } catch (error) {
      showError(error);
      failOperation(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(null);
    }
  }

  function replacePhoto(updated: PhotoRecord) {
    setPhotos((current) => current.map((photo) => (photo.id === updated.id ? updated : photo)));
    setSimilarGroups((current) =>
      current.map((group) => ({
        ...group,
        photos: group.photos.map((item) =>
          item.photo.id === updated.id ? { ...item, photo: updated } : item,
        ),
      })),
    );
  }

  function showError(error: unknown) {
    const message = error instanceof Error ? error.message : "操作失败";
    setNotice({ type: "error", message });
  }

  function goPreview(offset: number) {
    if (!previewPhotoId || photos.length === 0) return;
    const index = photos.findIndex((photo) => photo.id === previewPhotoId);
    const nextIndex = (index + offset + photos.length) % photos.length;
    setPreviewPhotoId(photos[nextIndex]?.id ?? null);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelect={setSelectedProjectId}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          project={selectedProject}
          view={view}
          busy={busy}
          onViewChange={setView}
          onImport={handleScan}
          onAnalyze={handleAnalyze}
          onVisionAnalyze={handleVisionAnalyze}
          onBuildSimilar={handleBuildSimilar}
          onRefresh={() => {
            if (selectedProjectId) {
              void loadProjects(selectedProjectId);
              void loadPhotos();
              void loadSimilarGroups();
              void loadSettings();
            }
          }}
        />

        <div className="flex min-h-0 flex-1">
          {view === "dashboard" && (
            <DashboardPanel
              project={selectedProject}
              photos={photos}
              backendStatus={backendStatus}
              onImport={() => {
                setView("import");
                void handleScan();
              }}
              onAnalyze={() => {
                setView("analysis");
                void handleAnalyze();
              }}
              onReview={() => setView("review")}
              onExport={() => setView("export")}
            />
          )}

          {view === "import" && (
            <ImportPanel
              project={selectedProject}
              photos={photos}
              busy={busy === "scan"}
              lastScan={lastScan}
              onImport={handleScan}
              onReview={() => setView("review")}
            />
          )}

          {view === "analysis" && (
            <AnalysisPanel
              project={selectedProject}
              photos={photos}
              busy={Boolean(busy)}
              onAnalyze={handleAnalyze}
              onBuildSimilar={handleBuildSimilar}
              onVisionAnalyze={handleVisionAnalyze}
            />
          )}

          {view === "review" && (
            <>
              <FilterPanel
                status={statusFilter}
                category={categoryFilter}
                issueTag={issueTagFilter}
                search={search}
                sort={sort}
                onStatusChange={setStatusFilter}
                onCategoryChange={setCategoryFilter}
                onIssueTagChange={setIssueTagFilter}
                onSearchChange={setSearch}
                onSortChange={setSort}
              />
              <section className="min-w-0 flex-1 overflow-y-auto">
                <SummaryBar photos={photos} />
                <ImageGrid
                  photos={photos}
                  selectedPhotoId={selectedPhotoId}
                  onSelect={(photo) => setSelectedPhotoId(photo.id)}
                  onPreview={(photo) => setPreviewPhotoId(photo.id)}
                  onStatusChange={handleStatusChange}
                />
              </section>
              <DetailPanel
                photo={selectedPhoto}
                onStatusChange={handleStatusChange}
                onUpdate={handlePhotoUpdate}
                onPreview={(photo) => setPreviewPhotoId(photo.id)}
              />
            </>
          )}

          {view === "similar" && (
            <section className="min-w-0 flex-1 overflow-y-auto">
              <SimilarGroupsPanel
                groups={similarGroups}
                onSelectPhoto={(photo) => {
                  setSelectedPhotoId(photo.id);
                  setView("review");
                }}
                onPreviewPhoto={(photo) => setPreviewPhotoId(photo.id)}
                onSetRecommended={handleSetRecommended}
                onApplyRecommendation={handleApplyRecommendation}
              />
            </section>
          )}

          {view === "settings" && (
            <section className="min-w-0 flex-1 overflow-y-auto">
              <SettingsPanel settings={settings} onSave={handleSaveSettings} />
            </section>
          )}

          {view === "export" && (
            <section className="min-w-0 flex-1 overflow-y-auto">
              <ExportPanel
                project={selectedProject}
                busy={busy === "export"}
                lastResult={lastExport}
                onExport={handleExport}
              />
            </section>
          )}
        </div>
      </main>

      <PreviewModal
        photo={previewPhoto}
        onClose={() => setPreviewPhotoId(null)}
        onPrevious={() => goPreview(-1)}
        onNext={() => goPreview(1)}
        onStatusChange={handleStatusChange}
      />

      <StartupOverlay status={backendStatus} />
      <OperationProgress
        label={activeOperation?.label ?? "正在处理"}
        status={operationProgress}
        visible={Boolean(activeOperation)}
      />

      {busy && (
        <div className="pointer-events-none fixed right-5 top-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-panel">
          {busyLabels[busy] ?? "正在处理"}
        </div>
      )}
      {notice && (
        <button
          className={`fixed bottom-5 left-1/2 max-w-[760px] -translate-x-1/2 rounded-lg border px-4 py-3 text-left text-sm shadow-panel ${
            notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-700"
          }`}
          onClick={() => setNotice(null)}
        >
          {notice.message}
        </button>
      )}
    </div>
  );
}

function SummaryBar({ photos }: { photos: PhotoRecord[] }) {
  const keepCount = photos.filter((photo) => photo.status === "keep").length;
  const candidateCount = photos.filter((photo) => photo.status === "candidate").length;
  const rejectCount = photos.filter((photo) => photo.status === "reject").length;
  const pendingCount = photos.filter((photo) => photo.status === "pending").length;
  const analyzedCount = photos.filter((photo) => photo.total_score !== null && photo.total_score !== undefined).length;
  const similarCount = new Set(photos.map((photo) => photo.similar_group_id).filter(Boolean)).size;

  return (
    <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-slate-200 bg-slate-100/95 px-5 backdrop-blur">
      <div className="text-sm font-medium text-slate-700">
        总照片 <span className="text-teal-700">{photos.length}</span> · 已分析 {analyzedCount}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>保留 {keepCount}</span>
        <span>备选 {candidateCount}</span>
        <span>淘汰 {rejectCount}</span>
        <span>待确认 {pendingCount}</span>
        <span>相似组 {similarCount}</span>
      </div>
    </div>
  );
}

async function pickFolder(): Promise<string | null> {
  if (window.qingying?.selectFolder) {
    return window.qingying.selectFolder();
  }
  return window.prompt("请输入本地图片文件夹路径")?.trim() || null;
}

function progressFromStatus(status: AnalysisStatus, key: OperationTaskKey): TaskProgress | null {
  if (key === "status" || key === "settings") {
    return null;
  }
  return status[key] ?? null;
}

import { Bot, CheckCircle2, Download, FolderOpen, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import type { BackendStatus, PhotoRecord, Project } from "../types";

interface DashboardPanelProps {
  project: Project | null;
  photos: PhotoRecord[];
  backendStatus: BackendStatus | null;
  onImport: () => void;
  onAnalyze: () => void;
  onReview: () => void;
  onExport: () => void;
}

export function DashboardPanel({
  project,
  photos,
  backendStatus,
  onImport,
  onAnalyze,
  onReview,
  onExport,
}: DashboardPanelProps) {
  const analyzedCount = photos.filter((photo) => photo.total_score !== null && photo.total_score !== undefined).length;
  const keepCount = photos.filter((photo) => photo.status === "keep").length;
  const rejectCount = photos.filter((photo) => photo.status === "reject").length;
  const recommendedCount = photos.filter((photo) => photo.recommended_usage === "推文封面候选").length;

  return (
    <section className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-6 flex items-start justify-between gap-5">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">青影智筛</h2>
            <div className="mt-2 text-sm text-slate-500">
              {project ? `${project.name} · ${project.photo_count ?? project.image_count} 张照片` : "请选择或新建活动项目"}
            </div>
          </div>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              backendStatus?.error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <div className="font-medium">{backendStatus?.error ? "后端连接异常" : "后端已连接"}</div>
            <div className="mt-1 text-xs opacity-80">{backendStatus?.error || backendStatus?.url || "等待检测"}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Stat label="已导入" value={photos.length} />
          <Stat label="已分析" value={analyzedCount} />
          <Stat label="保留" value={keepCount} />
          <Stat label="淘汰" value={rejectCount} />
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <FlowStep icon={<FolderOpen size={20} />} title="导入照片" action="选择文件夹" onClick={onImport} />
          <FlowStep icon={<Bot size={20} />} title="AI 初筛" action="开始分析" onClick={onAnalyze} />
          <FlowStep icon={<ListChecks size={20} />} title="人工复核" action="进入复核" onClick={onReview} />
          <FlowStep icon={<Download size={20} />} title="分类导出" action="导出素材" onClick={onExport} />
        </div>

        <div className="mt-6 grid grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-slate-900">当前项目</div>
            {project ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="活动类型" value={project.event_type || "其他"} />
                <Info label="活动日期" value={project.event_date || "-"} />
                <Info label="活动地点" value={project.location || "-"} />
                <Info label="照片目录" value={project.source_path || "-"} />
              </div>
            ) : (
              <div className="text-sm text-slate-500">左侧创建项目后会显示项目概览。</div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-slate-900">宣传候选</div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="text-2xl font-semibold text-slate-950">{recommendedCount}</div>
                <div className="text-sm text-slate-500">张推荐宣传图</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function FlowStep({
  icon,
  title,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-600"
      onClick={onClick}
    >
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-xs font-medium text-teal-700">{action}</div>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-slate-900" title={value}>
        {value}
      </div>
    </div>
  );
}

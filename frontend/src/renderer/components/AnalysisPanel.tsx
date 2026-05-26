import { Bot, Images, Play } from "lucide-react";
import type { ReactNode } from "react";
import type { PhotoRecord, Project } from "../types";
import { formatNumber } from "../utils/format";

interface AnalysisPanelProps {
  project: Project | null;
  photos: PhotoRecord[];
  busy: boolean;
  onAnalyze: () => void;
  onBuildSimilar: () => void;
  onVisionAnalyze: () => void;
}

export function AnalysisPanel({
  project,
  photos,
  busy,
  onAnalyze,
  onBuildSimilar,
  onVisionAnalyze,
}: AnalysisPanelProps) {
  const analyzed = photos.filter((photo) => photo.total_score !== null && photo.total_score !== undefined);
  const avgScore = analyzed.length
    ? analyzed.reduce((sum, photo) => sum + (photo.total_score ?? 0), 0) / analyzed.length
    : null;
  const issueCount = photos.filter((photo) => photo.issue_tags.length > 0).length;
  const similarGroupCount = new Set(photos.map((photo) => photo.similar_group_id).filter(Boolean)).size;

  return (
    <section className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-slate-900">智能初筛</div>
            <div className="mt-1 text-sm text-slate-500">
              {project ? `${project.name} · ${photos.length} 张照片` : "未选择项目"}
            </div>
          </div>
          <div className="flex gap-2">
            <Action icon={<Play size={17} />} label="开始分析" disabled={!project || busy} onClick={onAnalyze} />
            <Action icon={<Images size={17} />} label="相似聚类" disabled={!project || busy} onClick={onBuildSimilar} />
            <Action icon={<Bot size={17} />} label="大模型分析" disabled={!project || busy} onClick={onVisionAnalyze} />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-4">
          <Stat label="已分析" value={`${analyzed.length}/${photos.length}`} />
          <Stat label="平均分" value={avgScore === null ? "-" : formatNumber(avgScore, 1)} />
          <Stat label="问题照片" value={String(issueCount)} />
          <Stat label="相似组" value={String(similarGroupCount)} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_repeat(5,0.7fr)] border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
            <span>文件名</span>
            <span>综合</span>
            <span>清晰度</span>
            <span>曝光</span>
            <span>分辨率</span>
            <span>问题</span>
          </div>
          {photos.slice(0, 80).map((photo) => (
            <div
              key={photo.id}
              className="grid grid-cols-[1.4fr_repeat(5,0.7fr)] border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0"
            >
              <span className="truncate pr-3" title={photo.file_name}>{photo.file_name}</span>
              <span>{score(photo.total_score)}</span>
              <span>{score(photo.blur_score)}</span>
              <span>{score(photo.exposure_score)}</span>
              <span>{score(photo.resolution_score)}</span>
              <span className="truncate" title={photo.issue_tags.join("、")}>{photo.issue_tags.join("、") || "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Action({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-teal-600 hover:text-teal-700 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function score(value?: number | null) {
  return value === null || value === undefined ? "-" : formatNumber(value, 0);
}

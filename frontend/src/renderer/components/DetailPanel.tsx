import { Check, Clock, Copy, Eye, Image as ImageIcon, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { PhotoRecord, PhotoStatus } from "../types";
import {
  formatBytes,
  formatNumber,
  formatResolution,
  RECOMMENDED_USAGES,
  SCENE_TYPES,
  statusLabel,
} from "../utils/format";
import { StatusBadge } from "./StatusBadge";

interface DetailPanelProps {
  photo: PhotoRecord | null;
  onStatusChange: (photoId: number, status: PhotoStatus) => void;
  onUpdate: (photoId: number, payload: Partial<PhotoRecord>) => Promise<void>;
  onPreview: (photo: PhotoRecord) => void;
}

export function DetailPanel({ photo, onStatusChange, onUpdate, onPreview }: DetailPanelProps) {
  const [category, setCategory] = useState("");
  const [usage, setUsage] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategory(photo?.user_category || photo?.ai_category || "待人工确认");
    setUsage(photo?.recommended_usage || "活动归档");
    setNotes(photo?.notes || "");
  }, [photo]);

  if (!photo) {
    return (
      <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="grid h-full place-items-center px-8 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <ImageIcon size={22} />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-800">未选择图片</div>
            <div className="mt-2 text-sm text-slate-500">点击网格中的照片查看评分和复核信息</div>
          </div>
        </div>
      </aside>
    );
  }

  async function saveReview() {
    if (!photo) return;
    setSaving(true);
    try {
      await onUpdate(photo.id, {
        user_category: category,
        recommended_usage: usage,
        notes,
      });
    } finally {
      setSaving(false);
    }
  }

  const ai = photo.latest_ai_analysis;

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="truncate text-sm font-semibold text-slate-900" title={photo.file_name}>
          {photo.file_name}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge type="status" value={photo.status} />
          {photo.is_similar_recommended && <StatusBadge type="plain" value="组内推荐" />}
          {photo.similar_group_id && <StatusBadge type="plain" value={`相似组 #${photo.similar_group_id}`} />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <button
            className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-200"
            onClick={() => onPreview(photo)}
            title="大图预览"
          >
            <img className="h-full w-full object-contain" src={api.thumbnailUrl(photo.id)} alt={photo.file_name} />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-700">
              <Eye size={13} />
              预览
            </span>
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <h2 className="panel-title">本地评分</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="综合评分" value={score(photo.total_score)} />
              <Metric label="清晰度" value={score(photo.blur_score)} />
              <Metric label="曝光" value={score(photo.exposure_score)} />
              <Metric label="分辨率" value={score(photo.resolution_score)} />
              <Metric label="构图" value={score(photo.composition_score)} />
              <Metric label="尺寸" value={formatResolution(photo.width, photo.height)} />
              <Metric label="文件大小" value={formatBytes(photo.file_size)} />
              <Metric label="格式" value={photo.image_format || "-"} />
            </dl>
          </section>

          <section>
            <h2 className="panel-title">问题标签</h2>
            <div className="flex flex-wrap gap-2">
              {photo.issue_tags.length > 0 ? (
                photo.issue_tags.map((flag) => <StatusBadge key={flag} type="flag" value={flag} />)
              ) : (
                <span className="text-sm text-slate-500">暂无明显问题</span>
              )}
            </div>
          </section>

          <section>
            <h2 className="panel-title">人工状态</h2>
            <div className="grid grid-cols-2 gap-2">
              <StatusButton
                icon={<Check size={16} />}
                label={statusLabel("keep")}
                active={photo.status === "keep"}
                onClick={() => onStatusChange(photo.id, "keep")}
              />
              <StatusButton
                icon={<Star size={16} />}
                label={statusLabel("candidate")}
                active={photo.status === "candidate"}
                onClick={() => onStatusChange(photo.id, "candidate")}
              />
              <StatusButton
                icon={<X size={16} />}
                label={statusLabel("reject")}
                active={photo.status === "reject"}
                onClick={() => onStatusChange(photo.id, "reject")}
              />
              <StatusButton
                icon={<Clock size={16} />}
                label={statusLabel("pending")}
                active={photo.status === "pending"}
                onClick={() => onStatusChange(photo.id, "pending")}
              />
            </div>
          </section>

          <section>
            <h2 className="panel-title">分类与备注</h2>
            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">人工分类</span>
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
                {SCENE_TYPES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">推荐用途</span>
              <select className="input" value={usage} onChange={(event) => setUsage(event.target.value)}>
                {RECOMMENDED_USAGES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">人工备注</span>
              <textarea
                className="input h-20 resize-none py-2"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <button
              className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-teal-700 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={saving}
              onClick={saveReview}
            >
              保存复核信息
            </button>
          </section>

          <section>
            <h2 className="panel-title">大模型分析</h2>
            {ai ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex flex-wrap gap-2">
                  {ai.scene_type && <StatusBadge type="plain" value={ai.scene_type} />}
                  {ai.recommended_usage && <StatusBadge type="plain" value={ai.recommended_usage} />}
                </div>
                <p className="leading-6">{ai.description || "暂无说明"}</p>
                <p className="leading-6 text-slate-500">{ai.reason || "暂无推荐理由"}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">尚未进行大模型分析，或当前未启用。</p>
            )}
          </section>

          <section>
            <h2 className="panel-title">文件路径</h2>
            <button
              className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs text-slate-600 hover:border-teal-600"
              onClick={() => navigator.clipboard?.writeText(photo.file_path)}
              title="复制路径"
            >
              <Copy size={14} className="mt-0.5 shrink-0" />
              <span className="break-all">{photo.file_path}</span>
            </button>
          </section>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-900" title={value}>
        {value}
      </dd>
    </div>
  );
}

function StatusButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium ${
        active
          ? "border-teal-600 bg-teal-50 text-teal-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function score(value?: number | null): string {
  return value === null || value === undefined ? "-" : `${formatNumber(value, 1)} / 100`;
}

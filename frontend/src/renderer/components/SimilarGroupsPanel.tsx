import { Check, Star } from "lucide-react";
import { api } from "../api/client";
import type { PhotoRecord, SimilarGroup } from "../types";
import { formatNumber } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

interface SimilarGroupsPanelProps {
  groups: SimilarGroup[];
  onSelectPhoto: (photo: PhotoRecord) => void;
  onPreviewPhoto: (photo: PhotoRecord) => void;
  onSetRecommended: (groupId: number, photoId: number) => void;
  onApplyRecommendation: (groupId: number) => void;
}

export function SimilarGroupsPanel({
  groups,
  onSelectPhoto,
  onPreviewPhoto,
  onSetRecommended,
  onApplyRecommendation,
}: SimilarGroupsPanelProps) {
  if (groups.length === 0) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <div className="text-base font-semibold text-slate-800">暂无相似照片组</div>
          <div className="mt-2 text-sm text-slate-500">先完成本地分析，再点击相似聚类</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      {groups.map((group) => (
        <section key={group.id} className="border-b border-slate-200 pb-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">相似组 #{group.id}</div>
              <div className="mt-1 text-xs text-slate-500">{group.photos.length} 张照片</div>
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-teal-600 hover:text-teal-700"
              onClick={() => onApplyRecommendation(group.id)}
            >
              <Check size={16} />
              保留推荐图
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            {group.photos.map(({ photo, similarity_score, is_recommended }) => (
              <button
                key={photo.id}
                className={`overflow-hidden rounded-lg border bg-white text-left shadow-sm ${
                  is_recommended ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"
                }`}
                onClick={() => onSelectPhoto(photo)}
                onDoubleClick={() => onPreviewPhoto(photo)}
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img
                    className="h-full w-full object-cover"
                    src={api.thumbnailUrl(photo.id)}
                    alt={photo.file_name}
                  />
                  {is_recommended && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-teal-700">
                      <Star size={13} />
                      推荐
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-semibold text-slate-900">{photo.file_name}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge type="status" value={photo.status} />
                    <StatusBadge type="score" value={formatNumber(photo.total_score, 0)} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    相似度 {similarity_score === null || similarity_score === undefined ? "-" : `${Math.round(similarity_score * 100)}%`}
                  </div>
                  {!is_recommended && (
                    <span
                      className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:border-teal-600 hover:text-teal-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSetRecommended(group.id, photo.id);
                      }}
                    >
                      设为推荐
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

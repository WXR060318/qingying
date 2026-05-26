import { Check, Clock, Eye, Star, X } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { api } from "../api/client";
import type { PhotoRecord, PhotoStatus } from "../types";
import { formatBytes, formatNumber, formatResolution } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

interface ImageGridProps {
  photos: PhotoRecord[];
  selectedPhotoId: number | null;
  onSelect: (photo: PhotoRecord) => void;
  onPreview: (photo: PhotoRecord) => void;
  onStatusChange: (photoId: number, status: PhotoStatus) => void;
}

export function ImageGrid({
  photos,
  selectedPhotoId,
  onSelect,
  onPreview,
  onStatusChange,
}: ImageGridProps) {
  if (photos.length === 0) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <div className="text-base font-semibold text-slate-800">暂无图片</div>
          <div className="mt-2 text-sm text-slate-500">选择照片文件夹并扫描后会显示在这里</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-5">
      {photos.map((photo) => {
        const active = photo.id === selectedPhotoId;
        const tags = photo.issue_tags?.length ? photo.issue_tags : photo.quality_flags;
        return (
          <div
            key={photo.id}
            role="button"
            tabIndex={0}
            className={`group overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel ${
              active ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"
            }`}
            onClick={() => onSelect(photo)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(photo);
            }}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <img
                className="h-full w-full object-cover"
                src={api.thumbnailUrl(photo)}
                alt={photo.file_name}
                loading="lazy"
              />
              {photo.is_similar_recommended && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-teal-700">
                  <Star size={13} />
                  组内推荐
                </div>
              )}
              {photo.similar_group_id && !photo.is_similar_recommended && (
                <div className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-orange-700">
                  相似组 #{photo.similar_group_id}
                </div>
              )}
              <button
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100"
                title="大图预览"
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview(photo);
                }}
              >
                <Eye size={15} />
              </button>
              <div className="absolute bottom-2 right-2">
                <StatusBadge
                  type="score"
                  value={
                    photo.total_score === null || photo.total_score === undefined
                      ? "未分析"
                      : formatNumber(photo.total_score, 0)
                  }
                />
              </div>
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-semibold text-slate-900" title={photo.file_name}>
                {photo.file_name}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{formatResolution(photo.width, photo.height)}</span>
                <span>{formatBytes(photo.file_size)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge type="status" value={photo.status} />
                {(photo.user_category || photo.ai_category) && (
                  <StatusBadge type="plain" value={photo.user_category || photo.ai_category || ""} />
                )}
                {tags.slice(0, 2).map((flag) => (
                  <StatusBadge key={flag} type="flag" value={flag} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <SmallAction
                  title="已入选"
                  active={photo.status === "keep"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange(photo.id, "keep");
                  }}
                >
                  <Check size={15} />
                </SmallAction>
                <SmallAction
                  title="备选"
                  active={photo.status === "candidate"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange(photo.id, "candidate");
                  }}
                >
                  <Star size={15} />
                </SmallAction>
                <SmallAction
                  title="已淘汰"
                  active={photo.status === "reject"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange(photo.id, "reject");
                  }}
                >
                  <X size={15} />
                </SmallAction>
                <SmallAction
                  title="待人工复核"
                  active={photo.status === "pending"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange(photo.id, "pending");
                  }}
                >
                  <Clock size={15} />
                </SmallAction>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmallAction({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      className={`inline-flex h-8 items-center justify-center rounded-md border ${
        active
          ? "border-teal-600 bg-teal-50 text-teal-700"
          : "border-slate-200 bg-white text-slate-500 hover:border-teal-600 hover:text-teal-700"
      }`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

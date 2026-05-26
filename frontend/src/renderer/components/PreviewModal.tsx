import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { api } from "../api/client";
import type { PhotoRecord, PhotoStatus } from "../types";
import { statusLabel } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

interface PreviewModalProps {
  photo: PhotoRecord | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onStatusChange: (photoId: number, status: PhotoStatus) => void;
}

export function PreviewModal({
  photo,
  onClose,
  onPrevious,
  onNext,
  onStatusChange,
}: PreviewModalProps) {
  useEffect(() => {
    if (!photo) return;
    const currentPhotoId = photo.id;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === "ArrowRight") onNext();
      if (event.key.toLowerCase() === "a") onStatusChange(currentPhotoId, "keep");
      if (event.key.toLowerCase() === "s") onStatusChange(currentPhotoId, "candidate");
      if (event.key.toLowerCase() === "d") onStatusChange(currentPhotoId, "reject");
      if (event.key.toLowerCase() === "p") onStatusChange(currentPhotoId, "pending");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photo, onClose, onNext, onPrevious, onStatusChange]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/92 text-white">
      <button
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        onClick={onClose}
        title="关闭"
      >
        <X size={20} />
      </button>
      <button
        className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        onClick={onPrevious}
        title="上一张"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        onClick={onNext}
        title="下一张"
      >
        <ChevronRight size={22} />
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center p-12">
        <img
          className="max-h-full max-w-full object-contain"
          src={api.photoFileUrl(photo)}
          alt={photo.file_name}
        />
      </div>

      <aside className="w-80 shrink-0 border-l border-white/10 bg-slate-950/80 p-5">
        <div className="truncate text-sm font-semibold">{photo.file_name}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge type="status" value={photo.status} />
          {photo.user_category && <StatusBadge type="plain" value={photo.user_category} />}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {(["keep", "candidate", "reject", "pending"] as PhotoStatus[]).map((status) => (
            <button
              key={status}
              className={`h-9 rounded-md border text-sm font-medium ${
                photo.status === status
                  ? "border-teal-300 bg-teal-300 text-slate-950"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
              onClick={() => onStatusChange(photo.id, status)}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-2 text-sm text-slate-300">
          <div>综合评分：{photo.total_score ?? "-"}</div>
          <div>问题标签：{photo.issue_tags.length ? photo.issue_tags.join("、") : "暂无"}</div>
          <div>推荐用途：{photo.recommended_usage || "-"}</div>
        </div>
      </aside>
    </div>
  );
}

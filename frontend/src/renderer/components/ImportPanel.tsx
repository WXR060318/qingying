import { FolderSync, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { PhotoRecord, Project, ScanResult } from "../types";

interface ImportPanelProps {
  project: Project | null;
  photos: PhotoRecord[];
  busy: boolean;
  lastScan: ScanResult | null;
  onImport: () => void;
  onReview: () => void;
}

export function ImportPanel({
  project,
  photos,
  busy,
  lastScan,
  onImport,
  onReview,
}: ImportPanelProps) {
  return (
    <section className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-slate-900">照片导入</div>
            <div className="mt-1 text-sm text-slate-500">{project?.source_path || "未选择照片文件夹"}</div>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-teal-600 hover:text-teal-700 disabled:opacity-50"
              disabled={!project || busy}
              onClick={onImport}
            >
              <FolderSync size={17} />
              {photos.length ? "重新导入" : "选择文件夹"}
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              disabled={!project || photos.length === 0}
              onClick={onReview}
            >
              <RefreshCw size={17} />
              查看照片
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-4">
          <Stat label="当前照片" value={photos.length} />
          <Stat label="本次扫描" value={lastScan?.scanned_count ?? 0} />
          <Stat label="新增" value={lastScan?.imported_count ?? 0} />
          <Stat label="失败" value={lastScan?.failed_count ?? 0} />
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {photos.slice(0, 48).map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[4/3] bg-slate-100">
                <img className="h-full w-full object-cover" src={api.thumbnailUrl(photo)} alt={photo.file_name} />
              </div>
              <div className="truncate px-3 py-2 text-xs font-medium text-slate-700" title={photo.file_name}>
                {photo.file_name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

import { Download, FolderOpen } from "lucide-react";
import { useState } from "react";
import type { ExportRange, ExportResult, Project } from "../types";

interface ExportPanelProps {
  project: Project | null;
  busy: boolean;
  lastResult: ExportResult | null;
  onExport: (exportDir: string | null, exportRange: ExportRange, includeExcel: boolean) => Promise<void>;
}

export function ExportPanel({ project, busy, lastResult, onExport }: ExportPanelProps) {
  const [exportDir, setExportDir] = useState("");
  const [exportRange, setExportRange] = useState<ExportRange>("keep_candidate");
  const [includeExcel, setIncludeExcel] = useState(true);

  async function pickExportFolder() {
    const folder = await pickFolder();
    if (folder) setExportDir(folder);
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-5">
        <div className="text-base font-semibold text-slate-900">导出结果</div>
        <div className="mt-1 text-sm text-slate-500">
          原始照片不会被修改，导出会复制文件并生成筛选报告。
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">导出目录</span>
          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-1"
              value={exportDir}
              onChange={(event) => setExportDir(event.target.value)}
              placeholder="留空则导出到后端 storage/exports"
            />
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
              title="选择导出目录"
              onClick={pickExportFolder}
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">导出范围</span>
          <select className="input" value={exportRange} onChange={(event) => setExportRange(event.target.value as ExportRange)}>
            <option value="keep_only">仅保留照片</option>
            <option value="keep_candidate">保留 + 备选照片</option>
            <option value="reject_only">仅淘汰照片</option>
            <option value="recommended_only">仅推荐宣传图</option>
            <option value="all">全部照片</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-slate-800">生成 Excel 筛选报告</span>
          <input
            type="checkbox"
            checked={includeExcel}
            onChange={(event) => setIncludeExcel(event.target.checked)}
          />
        </label>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={!project || busy}
          onClick={() => onExport(exportDir.trim() || null, exportRange, includeExcel)}
        >
          <Download size={16} />
          开始导出
        </button>
      </div>

      {lastResult && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">导出完成</div>
          <div className="mt-2 break-all">目录：{lastResult.export_dir}</div>
          {lastResult.report_path && <div className="mt-1 break-all">报告：{lastResult.report_path}</div>}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>保留 {lastResult.keep_count}</span>
            <span>备选 {lastResult.candidate_count}</span>
            <span>淘汰 {lastResult.reject_count}</span>
            <span>复制 {lastResult.copied_count}</span>
            <span>缺失 {lastResult.skipped_missing_count}</span>
          </div>
          {lastResult.errors.length > 0 && (
            <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs text-rose-700">
              {lastResult.errors.slice(0, 5).join("；")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function pickFolder(): Promise<string | null> {
  if (window.qingying?.selectExportFolder) {
    return window.qingying.selectExportFolder();
  }
  if (window.qingying?.selectFolder) {
    return window.qingying.selectFolder();
  }
  return window.prompt("请输入导出目录")?.trim() || null;
}

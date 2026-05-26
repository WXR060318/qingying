import { CheckCircle2, Loader2 } from "lucide-react";
import type { TaskProgress } from "../types";

interface OperationProgressProps {
  label: string;
  status: TaskProgress | null;
  visible: boolean;
}

export function OperationProgress({ label, status, visible }: OperationProgressProps) {
  if (!visible) return null;

  const isDone = status?.status === "completed" || status?.status === "skipped";
  const isError = status?.status === "error";
  const progressValue = status?.progress;
  const progress =
    typeof progressValue === "number" && Number.isFinite(progressValue)
      ? Math.round(Math.max(0, Math.min(1, progressValue)) * 100)
      : 12;

  return (
    <div className="fixed bottom-6 right-6 z-[60] w-[360px] rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-start gap-3">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            isError ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-700"
          }`}
        >
          {isDone || isError ? <CheckCircle2 size={20} /> : <Loader2 size={20} className="animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-950">{label}</div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {status?.message || (isDone ? "处理完成" : "正在处理")}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isError ? "bg-rose-500" : "bg-teal-600"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-right text-xs text-slate-500">{progress}%</div>
        </div>
      </div>
    </div>
  );
}

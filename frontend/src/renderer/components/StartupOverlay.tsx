import { Loader2 } from "lucide-react";
import type { BackendStatus } from "../types";

interface StartupOverlayProps {
  status: BackendStatus | null;
}

export function StartupOverlay({ status }: StartupOverlayProps) {
  if (!status || status.phase === "ready") return null;

  const isError = status.phase === "error" || Boolean(status.error);
  const progress = Number.isFinite(status.progress) ? status.progress : 8;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/20 backdrop-blur-sm">
      <div className="w-[420px] rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex items-start gap-4">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
              isError ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-700"
            }`}
          >
            <Loader2 size={22} className={isError ? "" : "animate-spin"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-base font-semibold ${isError ? "text-rose-700" : "text-slate-950"}`}>
              {isError ? "后端启动失败" : "正在启动青影智筛"}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {status.error || status.message || "正在准备本地服务"}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isError ? "bg-rose-500" : "bg-teal-600"
                }`}
                style={{ width: `${isError ? 100 : progress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{status.mode === "production" ? "内置后端" : "开发后端"}</span>
              <span>{isError ? "请查看日志" : `${Math.round(progress)}%`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ManualStatus, PhotoStatus, SuggestStatus } from "../types";
import { manualLabel, qualityFlagLabel, statusLabel, suggestLabel } from "../utils/format";

interface StatusBadgeProps {
  type: "status" | "suggest" | "manual" | "flag" | "plain" | "score";
  value: PhotoStatus | SuggestStatus | ManualStatus | string | number;
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  const styles = getStyles(type, String(value));
  const label =
    type === "status"
      ? statusLabel(value as PhotoStatus)
      : type === "suggest"
        ? suggestLabel(value as SuggestStatus)
        : type === "manual"
          ? manualLabel(value as ManualStatus)
          : type === "flag"
            ? qualityFlagLabel(String(value))
            : type === "score"
              ? typeof value === "number" || /^\d/.test(String(value))
                ? `${value} 分`
                : String(value)
              : String(value);

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

function getStyles(type: StatusBadgeProps["type"], value: string) {
  if (type === "status") {
    if (value === "keep") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (value === "candidate") return "border-sky-200 bg-sky-50 text-sky-700";
    if (value === "reject") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (type === "suggest") {
    if (value === "keep") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (value === "reject") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (type === "manual") {
    if (value === "accepted") return "border-sky-200 bg-sky-50 text-sky-700";
    if (value === "selected") return "border-teal-200 bg-teal-50 text-teal-700";
    if (value === "rejected") return "border-slate-300 bg-slate-100 text-slate-600";
    return "border-slate-200 bg-white text-slate-600";
  }
  if (type === "flag") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  if (type === "score") {
    return "border-slate-200 bg-slate-900 text-white";
  }
  return "border-slate-200 bg-white text-slate-600";
}

import type { ManualStatus, PhotoStatus, SuggestStatus } from "../types";

export const EVENT_TYPES = [
  "会议",
  "讲座",
  "志愿服务",
  "校园文化活动",
  "文体活动",
  "颁奖表彰",
  "集体合影",
  "新闻采访",
  "其他",
];

export const SCENE_TYPES = [
  "会议全景",
  "嘉宾发言",
  "主持环节",
  "观众互动",
  "活动特写",
  "志愿服务",
  "颁奖表彰",
  "集体合影",
  "新闻采访",
  "宣传优选",
  "待人工确认",
];

export const ISSUE_TAGS = ["模糊", "过曝", "欠曝", "分辨率低", "构图待检查", "文件损坏"];

export const RECOMMENDED_USAGES = [
  "新闻稿头图",
  "新闻稿正文配图",
  "推文封面候选",
  "活动归档",
  "部门素材留存",
  "不建议使用",
];

export function formatBytes(value?: number | null): string {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatNumber(value?: number | null, digits = 1): string {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(digits);
}

export function formatResolution(width?: number | null, height?: number | null): string {
  if (!width || !height) return "-";
  return `${width} x ${height}`;
}

export function statusLabel(status: PhotoStatus): string {
  const labels: Record<PhotoStatus, string> = {
    keep: "已入选",
    candidate: "备选",
    reject: "已淘汰",
    pending: "待人工复核",
  };
  return labels[status];
}

export function suggestLabel(status: SuggestStatus): string {
  const labels: Record<SuggestStatus, string> = {
    keep: "建议保留",
    review: "待复核",
    reject: "建议剔除",
  };
  return labels[status];
}

export function manualLabel(status: ManualStatus): string {
  const labels: Record<ManualStatus, string> = {
    pending: "待处理",
    accepted: "已通过",
    rejected: "已剔除",
    selected: "精选",
  };
  return labels[status];
}

export function qualityFlagLabel(flag: string): string {
  const labels: Record<string, string> = {
    blurry: "模糊",
    too_dark: "欠曝",
    too_bright: "过曝",
    low_resolution: "分辨率低",
    unreadable: "文件损坏",
  };
  return labels[flag] ?? flag;
}

export function exposureLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    normal: "正常",
    underexposed: "欠曝",
    overexposed: "过曝",
  };
  return status ? labels[status] ?? status : "-";
}

export function resolutionStatusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    low: "低",
    normal: "正常",
    high: "高",
  };
  return status ? labels[status] ?? status : "-";
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

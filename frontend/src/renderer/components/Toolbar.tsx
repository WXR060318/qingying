import {
  Bot,
  Download,
  FolderSync,
  Gauge,
  Home,
  Images,
  LayoutGrid,
  Play,
  RefreshCw,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Project, ViewMode } from "../types";

interface ToolbarProps {
  project: Project | null;
  view: ViewMode;
  busy: string | null;
  onViewChange: (view: ViewMode) => void;
  onImport: () => void;
  onAnalyze: () => void;
  onVisionAnalyze: () => void;
  onBuildSimilar: () => void;
  onRefresh: () => void;
}

export function Toolbar({
  project,
  view,
  busy,
  onViewChange,
  onImport,
  onAnalyze,
  onVisionAnalyze,
  onBuildSimilar,
  onRefresh,
}: ToolbarProps) {
  const disabled = !project || Boolean(busy);

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-slate-900">
          {project ? project.name : "青影智筛"}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {project
            ? `${project.event_type || "其他"} · ${project.event_date || "未填写日期"} · ${
                project.location || "未填写地点"
              }`
            : "本地化 AI 活动照片智能初筛工作台"}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="mr-2 flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <TabButton active={view === "dashboard"} title="首页" onClick={() => onViewChange("dashboard")}>
            <Home size={16} />
          </TabButton>
          <TabButton active={view === "import"} title="照片导入" onClick={() => onViewChange("import")}>
            <FolderSync size={16} />
          </TabButton>
          <TabButton active={view === "analysis"} title="智能初筛" onClick={() => onViewChange("analysis")}>
            <Gauge size={16} />
          </TabButton>
          <TabButton active={view === "review"} title="人工复核" onClick={() => onViewChange("review")}>
            <LayoutGrid size={16} />
          </TabButton>
          <TabButton active={view === "similar"} title="相似照片" onClick={() => onViewChange("similar")}>
            <Images size={16} />
          </TabButton>
          <TabButton active={view === "settings"} title="设置" onClick={() => onViewChange("settings")}>
            <Settings size={16} />
          </TabButton>
          <TabButton active={view === "export"} title="导出" onClick={() => onViewChange("export")}>
            <Download size={16} />
          </TabButton>
        </div>

        <IconButton title="刷新" onClick={onRefresh} disabled={disabled}>
          <RefreshCw size={17} />
        </IconButton>
        <TextButton label="导入/重扫" onClick={onImport} disabled={disabled} icon={<FolderSync size={17} />} />
        <TextButton label="本地分析" onClick={onAnalyze} disabled={disabled} icon={<Play size={17} />} />
        <TextButton label="相似聚类" onClick={onBuildSimilar} disabled={disabled} icon={<Images size={17} />} />
        <TextButton label="大模型分析" onClick={onVisionAnalyze} disabled={disabled} icon={<Bot size={17} />} />
      </div>
    </header>
  );
}

function TabButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
        active ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IconButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700 disabled:opacity-50"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TextButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-teal-600 hover:text-teal-700 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

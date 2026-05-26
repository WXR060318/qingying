import { Check, FolderOpen, Images, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Project, ProjectCreatePayload } from "../types";
import { EVENT_TYPES, formatDate } from "../utils/format";

interface ProjectSidebarProps {
  projects: Project[];
  selectedProjectId: number | null;
  onSelect: (projectId: number) => void;
  onCreate: (payload: ProjectCreatePayload) => Promise<void>;
  onDelete: (projectId: number) => Promise<void>;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelect,
  onCreate,
  onDelete,
}: ProjectSidebarProps) {
  const [isCreating, setIsCreating] = useState(projects.length === 0);
  const [form, setForm] = useState<ProjectCreatePayload>({
    name: "",
    event_type: "校园文化活动",
    event_date: "",
    location: "",
    photographer: "",
    source_path: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (projects.length > 0) setIsCreating(false);
  }, [projects.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(cleanPayload(form));
      setForm({
        name: "",
        event_type: "校园文化活动",
        event_date: "",
        location: "",
        photographer: "",
        source_path: "",
        description: "",
      });
      setIsCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function selectSourceFolder() {
    const folder = await pickFolder();
    if (folder) setForm((current) => ({ ...current, source_path: folder }));
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-700 text-white">
            <Images size={21} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">青影智筛</h1>
            <p className="text-xs text-slate-500">本地化 AI 活动照片智能初筛工作台</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-semibold text-slate-800">活动项目</span>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-teal-600 hover:text-teal-700"
          title="新建项目"
          onClick={() => setIsCreating((value) => !value)}
        >
          <Plus size={17} />
        </button>
      </div>

      {isCreating && (
        <form className="mx-4 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={handleSubmit}>
          <Field label="活动名称">
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="如：五四表彰大会"
            />
          </Field>
          <Field label="活动类型">
            <select
              className="input"
              value={form.event_type ?? "其他"}
              onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}
            >
              {EVENT_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="活动日期">
              <input
                className="input"
                type="date"
                value={form.event_date ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))}
              />
            </Field>
            <Field label="摄影人员">
              <input
                className="input"
                value={form.photographer ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, photographer: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="活动地点">
            <input
              className="input"
              value={form.location ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
          </Field>
          <Field label="照片文件夹">
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1"
                value={form.source_path ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source_path: event.target.value }))
                }
                placeholder="选择或粘贴本地路径"
              />
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
                title="选择文件夹"
                onClick={selectSourceFolder}
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </Field>
          <Field label="项目备注">
            <textarea
              className="input h-16 resize-none py-2"
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <button
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={submitting || !form.name.trim()}
          >
            <Check size={16} />
            创建项目
          </button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
        {projects.map((project) => {
          const active = project.id === selectedProjectId;
          return (
            <button
              key={project.id}
              className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                active
                  ? "border-teal-600 bg-teal-50"
                  : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => onSelect(project.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {project.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span>{project.event_type || "其他"}</span>
                    <span>{project.photo_count ?? project.image_count} 张</span>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {formatDate(project.updated_at)}
                </span>
              </div>
              {active && (
                <div className="mt-3 space-y-2 text-xs text-slate-500">
                  <div className="truncate">{project.location || project.source_path || "未设置照片文件夹"}</div>
                  <div className="flex items-center justify-between">
                    <span className="truncate">{project.description || "暂无备注"}</span>
                    <span
                      className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-rose-600"
                      title="删除项目"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDelete(project.id);
                      }}
                    >
                      <Trash2 size={15} />
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function cleanPayload(form: ProjectCreatePayload): ProjectCreatePayload {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  ) as ProjectCreatePayload;
}

async function pickFolder(): Promise<string | null> {
  if (window.qingying?.selectFolder) {
    return window.qingying.selectFolder();
  }
  return window.prompt("请输入本地图片文件夹路径")?.trim() || null;
}

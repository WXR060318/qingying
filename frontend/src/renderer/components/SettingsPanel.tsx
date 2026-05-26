import { Bot, FolderOpen, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings } from "../types";

interface SettingsPanelProps {
  settings: AppSettings | null;
  onSave: (values: Record<string, string | null>) => Promise<void>;
}

export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(settings?.values ?? {});
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-700 text-white">
          <Bot size={20} />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-900">设置</div>
          <div className="text-sm text-slate-500">大模型是可选增强；未启用时仅使用本地算法。</div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal size={17} />
          本地筛选参数
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="清晰度阈值">
            <input
              className="input"
              type="number"
              min="0"
              max="500"
              value={values.blurThreshold ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, blurThreshold: event.target.value }))}
            />
          </Field>
          <Field label="曝光阈值">
            <input
              className="input"
              type="number"
              min="1"
              max="120"
              value={values.exposureThreshold ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, exposureThreshold: event.target.value }))}
            />
          </Field>
          <Field label="相似度阈值">
            <input
              className="input"
              type="number"
              min="1"
              max="32"
              value={values.similarityThreshold ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, similarityThreshold: event.target.value }))}
            />
          </Field>
          <Field label="后端端口">
            <input
              className="input"
              type="number"
              min="1024"
              max="65535"
              value={values.backendPort ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, backendPort: event.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="默认导入路径">
            <PathInput
              value={values.defaultImportDir ?? ""}
              onChange={(value) => setValues((current) => ({ ...current, defaultImportDir: value }))}
              mode="import"
            />
          </Field>
          <Field label="默认导出路径">
            <PathInput
              value={values.defaultExportDir ?? values["export.default_dir"] ?? ""}
              onChange={(value) => setValues((current) => ({ ...current, defaultExportDir: value }))}
              mode="export"
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-slate-800">启用大模型分析</span>
            <span className="mt-1 block text-xs text-slate-500">启用后才会主动上传图片到配置的模型供应商。</span>
          </span>
          <input
            type="checkbox"
            checked={(values.enableVisionModel ?? values["vision.enabled"]) === "true"}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                enableVisionModel: event.target.checked ? "true" : "false",
              }))
            }
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <Field label="模型供应商">
            <select
              className="input"
              value={values.visionProvider ?? values["vision.provider"] ?? "openai"}
              onChange={(event) =>
                setValues((current) => ({ ...current, visionProvider: event.target.value }))
              }
            >
              <option value="openai">OpenAI Vision</option>
              <option value="qwen-vl">Qwen-VL</option>
              <option value="gemini">Gemini Vision</option>
              <option value="ollama">Ollama 本地模型</option>
            </select>
          </Field>
          <Field label="模型名称">
            <input
              className="input"
              value={values.visionModel ?? values["vision.model"] ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, visionModel: event.target.value }))
              }
              placeholder="gpt-4o-mini"
            />
          </Field>
        </div>

        <Field label="API Key">
          <input
            className="input"
            type="password"
            value={values.visionApiKey ?? values["vision.api_key"] ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, visionApiKey: event.target.value }))
            }
            placeholder="仅保存在本地配置文件"
          />
        </Field>

        <Field label="API 地址">
          <input
            className="input"
            value={values.visionApiBase ?? values["vision.base_url"] ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, visionApiBase: event.target.value }))
            }
            placeholder="https://api.openai.com/v1"
          />
        </Field>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={saving}
          onClick={save}
        >
          <Save size={16} />
          保存设置
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function PathInput({
  value,
  mode,
  onChange,
}: {
  value: string;
  mode: "import" | "export";
  onChange: (value: string) => void;
}) {
  async function choose() {
    const folder = mode === "export"
      ? await window.qingying?.selectExportFolder?.()
      : await window.qingying?.selectFolder?.();
    if (folder) onChange(folder);
  }

  return (
    <div className="flex gap-2">
      <input className="input min-w-0 flex-1" value={value} onChange={(event) => onChange(event.target.value)} />
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
        title="选择文件夹"
        onClick={choose}
      >
        <FolderOpen size={16} />
      </button>
    </div>
  );
}

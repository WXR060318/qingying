import { Search } from "lucide-react";
import type { ReactNode } from "react";
import type { FilterMode, SortMode } from "../types";
import { ISSUE_TAGS, SCENE_TYPES } from "../utils/format";

interface FilterPanelProps {
  status: FilterMode;
  category: string;
  issueTag: string;
  search: string;
  sort: SortMode;
  onStatusChange: (value: FilterMode) => void;
  onCategoryChange: (value: string) => void;
  onIssueTagChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortMode) => void;
}

export function FilterPanel({
  status,
  category,
  issueTag,
  search,
  sort,
  onStatusChange,
  onCategoryChange,
  onIssueTagChange,
  onSearchChange,
  onSortChange,
}: FilterPanelProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 xl:block">
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">搜索</div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            className="input pl-9"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="文件名、备注、标签"
          />
        </div>
      </div>

      <SelectBlock label="状态" value={status} onChange={(value) => onStatusChange(value as FilterMode)}>
        <option value="all">全部</option>
        <option value="keep">已入选</option>
        <option value="candidate">备选</option>
        <option value="reject">已淘汰</option>
        <option value="pending">待人工复核</option>
      </SelectBlock>

      <SelectBlock label="分类" value={category} onChange={onCategoryChange}>
        <option value="all">全部</option>
        {SCENE_TYPES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </SelectBlock>

      <SelectBlock label="问题标签" value={issueTag} onChange={onIssueTagChange}>
        <option value="all">全部</option>
        {ISSUE_TAGS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </SelectBlock>

      <SelectBlock label="排序" value={sort} onChange={(value) => onSortChange(value as SortMode)}>
        <option value="score_desc">综合评分从高到低</option>
        <option value="score_asc">综合评分从低到高</option>
        <option value="blur_desc">清晰度从高到低</option>
        <option value="exposure_desc">曝光评分从高到低</option>
      </SelectBlock>
    </aside>
  );
}

function SelectBlock({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

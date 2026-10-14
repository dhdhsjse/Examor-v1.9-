"use client";

import { useState } from "react";
import type { Subject } from "@/app/_lib/subjects";
import type { ToolAction } from "@/app/_lib/tools";
import { getToolGroups } from "./toolGroups";
import ToolTile from "./ToolTile";

interface Props {
  subject: Subject;
  pageCount: number;
  questionCount: number;
  totalPoints: number;
  onTool: (action: ToolAction) => void;
}

// Left panel: searchable toolbox for the chosen subject.
export default function LeftPanel({ subject, pageCount, questionCount, totalPoints, onTool }: Props) {
  const [query, setQuery] = useState("");

  // Keep only tools whose name matches the search.
  const q = query.trim().toLowerCase();
  const visible = getToolGroups(subject)
    .map((g) => ({ ...g, tools: g.tools.filter((t) => t.label.toLowerCase().includes(q)) }))
    .filter((g) => g.tools.length > 0);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-3.5 pt-3.5 pb-3">
        <h2 className="text-sm font-semibold text-ink">
          {subject === "General" ? "General tools" : `${subject} toolbox`}
        </h2>

        {/* Search */}
        <label className="mt-2.5 flex h-8 items-center gap-2 rounded-md border border-line bg-subtle px-2.5 text-faint focus-within:border-indigo-300 focus-within:bg-white">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9.25 9.25L12.5 12.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
          />
        </label>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3.5 pb-4">
        {visible.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">{g.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {g.tools.map((t) => (
                <ToolTile key={t.label} icon={t.icon} label={t.label} tone={g.tone} action={t.action} onUse={onTool} />
              ))}
            </div>
          </section>
        ))}
        {visible.length === 0 && <p className="pt-6 text-center text-xs text-faint">No tools found</p>}
      </div>

      {/* Exam summary */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2 text-[11px] text-muted">
        <span>
          <b className="font-semibold text-ink">{questionCount}</b> question{questionCount === 1 ? "" : "s"}
        </span>
        <span>
          <b className="font-semibold text-ink">{totalPoints}</b> pts
        </span>
        <span>
          <b className="font-semibold text-ink">{pageCount}</b> page{pageCount === 1 ? "" : "s"}
        </span>
      </div>
    </aside>
  );
}

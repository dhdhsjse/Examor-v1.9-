"use client";

import type { ReactNode } from "react";

export type RightTab = "properties" | "library";

interface Props {
  tab: RightTab;
  onTab: (t: RightTab) => void;
  properties: ReactNode;
  library: ReactNode;
}

// Right side: "Properties" (edit the selected block) and "Library" (drag items onto the page).
export default function RightPanel({ tab, onTab, properties, library }: Props) {
  return (
    <aside className="flex w-[288px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex h-10 shrink-0 items-end gap-4 border-b border-line px-3.5">
        {(["properties", "library"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`-mb-px border-b-2 pb-2 text-[13px] capitalize transition-colors ${
              tab === t ? "border-indigo-600 font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === "properties" ? properties : library}</div>
    </aside>
  );
}

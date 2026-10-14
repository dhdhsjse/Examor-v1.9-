"use client";

import type { ReactNode } from "react";
import { useT } from "@/app/_lib/uiLang";

export type RightTab = "properties" | "library";

interface Props {
  tab: RightTab;
  onTab: (t: RightTab) => void;
  properties: ReactNode;
  library: ReactNode;
}

// Right side: "Properties" (edit the selected block) and "Library" (drag items onto the page).
export default function RightPanel({ tab, onTab, properties, library }: Props) {
  const t = useT();
  return (
    <aside className="flex w-[288px] shrink-0 flex-col border-s border-line bg-surface">
      <div className="flex h-10 shrink-0 items-end gap-4 border-b border-line px-3.5">
        {(["properties", "library"] as const).map((x) => (
          <button
            key={x}
            onClick={() => onTab(x)}
            className={`-mb-px border-b-2 pb-2 text-[13px] transition-colors ${
              tab === x ? "border-indigo-600 font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {x === "properties" ? t("Properties") : t("Library")}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === "properties" ? properties : library}</div>
    </aside>
  );
}

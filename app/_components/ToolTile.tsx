"use client";

import type { ReactNode } from "react";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import { useT } from "@/app/_lib/uiLang";

// Color of the icon chip (and hover border) for each tool group.
export type Tone = "indigo" | "amber" | "emerald";

const TONES: Record<Tone, { chip: string; hover: string }> = {
  indigo: { chip: "bg-indigo-50 text-indigo-600", hover: "hover:border-indigo-300" },
  amber: { chip: "bg-amber-50 text-amber-600", hover: "hover:border-amber-300" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", hover: "hover:border-emerald-300" },
};

interface Props {
  icon: ReactNode;
  label: string;
  tone: Tone;
  action: ToolAction;
  onUse: (action: ToolAction) => void;
}

// A small button in the toolbox (two per row): icon chip and a name of up to two lines.
// Click = add to the page; blocks can also be dragged onto it.
export default function ToolTile({ icon, label, tone, action, onUse }: Props) {
  const tr = useT();
  const t = TONES[tone];
  const draggable = action.kind === "block" || action.kind === "asset";

  return (
    <button
      onClick={() => onUse(action)}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(action));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={draggable ? tr("{label} — click or drag onto the page", { label }) : label}
      className={`flex h-11 min-w-0 items-center gap-1 rounded-lg border border-line bg-surface ps-1.5 pe-1 text-start shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:shadow-md active:shadow-none ${t.hover}`}
    >
      <span className={`grid size-6 shrink-0 place-items-center rounded-md ${t.chip}`}>{icon}</span>
      <span className="line-clamp-2 min-w-0 text-[11px] font-medium leading-tight break-words text-ink">{label}</span>
    </button>
  );
}

"use client";

import type { ReactNode } from "react";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";

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

// A small button in the toolbox. Click = add to the page; blocks can also be dragged onto it.
export default function ToolTile({ icon, label, tone, action, onUse }: Props) {
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
      title={draggable ? `${label} — click or drag onto the page` : label}
      className={`flex flex-col items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 pt-3 pb-2 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${t.hover}`}
    >
      <span className={`grid size-8 place-items-center rounded-md ${t.chip}`}>{icon}</span>
      <span className="text-[11px] font-medium leading-tight text-ink">{label}</span>
    </button>
  );
}

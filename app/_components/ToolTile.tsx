"use client";

import type { ReactNode } from "react";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import { useT } from "@/app/_lib/uiLang";

// Color of the icon for each tool group (the tile itself stays neutral grey).
export type Tone = "indigo" | "amber" | "emerald";

const TONES: Record<Tone, string> = {
  indigo: "text-indigo-600",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
};

interface Props {
  icon: ReactNode;
  label: string;
  tone: Tone;
  action: ToolAction;
  onUse: (action: ToolAction) => void;
}

// A small button in the toolbox (two per row): icon and a name of up to two lines.
// Click = add to the page; blocks can also be dragged onto it.
export default function ToolTile({ icon, label, tone, action, onUse }: Props) {
  const tr = useT();
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
      className="flex h-10 min-w-0 items-center gap-2 rounded-[5px] bg-subtle px-2 text-start transition-colors hover:bg-hover active:bg-line focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <span className={`ui-icon grid size-4 shrink-0 place-items-center ${TONES[tone]}`}>{icon}</span>
      <span className="line-clamp-2 min-w-0 text-[11px] leading-tight break-words text-ink">{label}</span>
    </button>
  );
}

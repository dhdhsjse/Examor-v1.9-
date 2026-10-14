"use client";

import type { ReactNode } from "react";

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
  onClick?: () => void; // no onClick = not built yet ("Soon")
}

// A small button in the toolbox. Tools that aren't ready show a "Soon" badge.
export default function ToolTile({ icon, label, tone, onClick }: Props) {
  const ready = Boolean(onClick);
  const t = TONES[tone];

  return (
    <button
      onClick={onClick}
      aria-disabled={!ready}
      title={ready ? label : `${label} (coming soon)`}
      className={`relative flex flex-col items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 pt-3 pb-2 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-md ${t.hover} ${
        ready ? "active:translate-y-0" : "cursor-default"
      }`}
    >
      <span className={`grid size-8 place-items-center rounded-md ${t.chip} ${ready ? "" : "opacity-60"}`}>
        {icon}
      </span>
      <span className={`text-[11px] font-medium leading-tight ${ready ? "text-ink" : "text-muted"}`}>{label}</span>
      {!ready && (
        <span className="absolute top-1 right-1 text-[8px] font-semibold uppercase tracking-wide text-faint">
          Soon
        </span>
      )}
    </button>
  );
}

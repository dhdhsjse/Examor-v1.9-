"use client";

import { useT } from "@/app/_lib/uiLang";

// "select" = click to select and drag blocks. "text" = like the T tool in Photoshop:
// click a text to type in it, or click empty paper to write a new text there.
export type CanvasTool = "select" | "text";

const TOOLS: { id: CanvasTool; label: string; key: string; icon: React.ReactNode }[] = [
  {
    id: "select",
    label: "Select and move",
    key: "V",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 1.5l9.5 7.2-4.3.6 2.6 4.9-1.9 1-2.6-5-3.3 3z" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text tool — click to type on the page",
    key: "T",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 3.5h10M8 3.5v10M6 13.5h4" />
      </svg>
    ),
  },
];

// Small floating toolbar next to the zoom bar (bottom-right), away from the page labels.
export default function ToolRail({ tool, onChange }: { tool: CanvasTool; onChange: (tool: CanvasTool) => void }) {
  const t = useT();
  return (
    <div className="pointer-events-auto flex gap-0.5 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
      {TOOLS.map((tl) => (
        <button
          key={tl.id}
          onClick={() => onChange(tl.id)}
          title={`${t(tl.label)} (${tl.key})`}
          className={`grid size-7 place-items-center rounded-md transition-colors ${
            tool === tl.id ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink"
          }`}
        >
          {tl.icon}
        </button>
      ))}
    </div>
  );
}

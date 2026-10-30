"use client";

import { Keyboard } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";

// "select" = click to select and drag blocks. "text" = like the T tool in Photoshop:
// click a text to type in it, or click empty paper to write a new text there.
// "textbox" = drag on a page to draw a text box (Insert → Text box); back to "select" once drawn.
// "shape" = drag on a page to draw the shape chosen in Insert → Shapes (not a button of this bar: the gallery sets it).
export type CanvasTool = "select" | "text" | "textbox" | "shape";

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
  {
    id: "textbox",
    label: "Text box — drag on the page to draw one",
    key: "B",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" strokeDasharray="2.2 2" />
        <path d="M5.5 5.75h5M8 5.75v4.5" />
      </svg>
    ),
  },
];

const toolBtn = (on: boolean) =>
  `grid size-7 place-items-center rounded-md transition-colors ${on ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink"}`;

// Small floating toolbar next to the zoom bar (bottom-right), away from the page labels. After a line, the math keyboard: it is not a
// tool (the tool stays as it is), it shows / hides the keyboard that types in the text being written.
export default function ToolRail({ tool, onChange, keyboardOpen, onToggleKeyboard }: {
  tool: CanvasTool;
  onChange: (tool: CanvasTool) => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}) {
  const t = useT();
  const keyboardText = keyboardOpen ? t("Hide math keyboard") : t("Show math keyboard");
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
      {TOOLS.map((tl) => (
        <button key={tl.id} onClick={() => onChange(tl.id)} aria-pressed={tool === tl.id} title={`${t(tl.label)} (${tl.key})`} className={toolBtn(tool === tl.id)}>
          {tl.icon}
        </button>
      ))}
      <span aria-hidden className="mx-1 h-5 w-px bg-line" />
      <button
        onClick={onToggleKeyboard}
        // Keeps the focus (and the cursor) in the text being typed in, and that text open (data-text-format).
        onMouseDown={(e) => e.preventDefault()}
        data-text-format=""
        aria-pressed={keyboardOpen}
        title={keyboardText}
        aria-label={keyboardText}
        data-testid="keyboard-toggle"
        className={toolBtn(keyboardOpen)}
      >
        <Keyboard size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

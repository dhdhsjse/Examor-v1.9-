"use client";

import { Eraser, Keyboard, Type } from "lucide-react";
import { toggleStudioKeyboard, useKeyboardStore } from "@/app/_components/math-keyboard/keyboardStore";
import DrawTools from "@/app/_components/workspace/DrawTools";
import type { InkTools } from "@/app/_lib/ink/useInkTools";
import { useT } from "@/app/_lib/uiLang";
import type { TableTool } from "./TableDrawingLayer";

// (the buttons of the page's floating tool bar, ToolRail)
const toolBtn = (on: boolean) =>
  `ui-icon grid size-8 place-items-center rounded-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-accent text-white" : "text-ink hover:bg-hover"}`;

// The floating tool bar of the Table Studio, at the bottom of the table, like the page's: Select, the Draw tool of the page (its
// brush, pencil and highlighter, with the same bubble of settings), Text box, Eraser; after a line, the math keyboard. What they
// draw goes on the table itself (TableDrawingLayer).
export default function TableToolDock({ tool, onTool, ink }: { tool: TableTool; onTool: (tool: TableTool) => void; ink: InkTools }) {
  const t = useT();
  const { studio: keyboardOpen } = useKeyboardStore();
  const keyboardText = keyboardOpen ? t("Hide math keyboard") : t("Show math keyboard");
  const textbox = t("Text box: drag on the table to draw one, then type");
  const eraser = t("Eraser: rub out a drawing or a shape");
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
      <div data-testid="table-tool-dock" dir="ltr" className="pointer-events-auto relative flex items-center gap-0.5 rounded-[10px] border border-line bg-surface p-1 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.16)]">
        <button type="button" onClick={() => onTool("select")} aria-pressed={tool === "select"} title={t("Select and move")} aria-label={t("Select and move")} data-testid="tool-select" className={toolBtn(tool === "select")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M3 1.5l9.5 7.2-4.3.6 2.6 4.9-1.9 1-2.6-5-3.3 3z" />
          </svg>
        </button>
        <DrawTools open={tool === "draw"} ink={ink} onOpen={() => onTool("draw")} />
        <button type="button" onClick={() => onTool(tool === "textbox" ? "select" : "textbox")} aria-pressed={tool === "textbox"} title={textbox} aria-label={textbox} data-testid="tool-textbox" className={toolBtn(tool === "textbox")}>
          <Type aria-hidden />
        </button>
        <button type="button" onClick={() => onTool(tool === "eraser" ? "select" : "eraser")} aria-pressed={tool === "eraser"} title={eraser} aria-label={eraser} data-testid="tool-eraser" className={toolBtn(tool === "eraser")}>
          <Eraser aria-hidden />
        </button>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
        <button
          type="button"
          onClick={toggleStudioKeyboard}
          // Keeps the focus (and the cursor) in the field being typed in.
          onMouseDown={(e) => e.preventDefault()}
          aria-pressed={keyboardOpen}
          title={keyboardText}
          aria-label={keyboardText}
          data-testid="keyboard-toggle"
          className={toolBtn(keyboardOpen)}
        >
          <Keyboard aria-hidden />
        </button>
      </div>
    </div>
  );
}

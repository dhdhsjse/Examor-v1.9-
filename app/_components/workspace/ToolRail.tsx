"use client";

import { Check, ChevronDown, Circle, Keyboard, Minus, MoveUpRight, Square, Star, Triangle, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/app/_lib/uiLang";

// "select" = click to select and drag blocks. "text" = like the T tool in Photoshop:
// click a text to type in it, or click empty paper to write a new text there.
// "textbox" = drag on a page to draw a text box (Insert → Text box); back to "select" once drawn.
// "shape" = drag on a page to draw a shape: the one of the Shapes button of this bar, or the one chosen in Insert → Shapes.
export type CanvasTool = "select" | "text" | "textbox" | "shape";

// The shapes of the Shapes button's menu, like Figma's (the whole gallery is in Insert → Shapes). `key` = its shortcut (Editor).
export const QUICK_SHAPES: { id: string; label: string; key: string; Icon: typeof Square }[] = [
  { id: "rect", label: "Rectangle", key: "R", Icon: Square },
  { id: "line", label: "Line", key: "L", Icon: Minus },
  { id: "arrow", label: "Arrow", key: "Shift+L", Icon: MoveUpRight },
  { id: "ellipse", label: "Ellipse", key: "O", Icon: Circle },
  { id: "triangle", label: "Triangle", key: "", Icon: Triangle },
  { id: "star5", label: "Star", key: "", Icon: Star },
];

const toolBtn = (on: boolean) =>
  `grid size-7 place-items-center rounded-md transition-colors ${on ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink"}`;

// Small floating toolbar next to the zoom bar (bottom-right), away from the page labels: Select, Shapes (its arrow opens the menu of
// shapes), Text box. After a line, the math keyboard: it is not a tool (the tool stays as it is), it shows / hides the keyboard that
// types in the text being written.
export default function ToolRail({ tool, onChange, shape, onPickShape, keyboardOpen, onToggleKeyboard }: {
  tool: CanvasTool;
  onChange: (tool: CanvasTool) => void;
  /** The shape the Shapes tool draws (null: none chosen yet) */
  shape: string | null;
  onPickShape: (shape: string) => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}) {
  const t = useT();
  const keyboardText = keyboardOpen ? t("Hide math keyboard") : t("Show math keyboard");
  const [menu, setMenu] = useState(false);
  const shapesRef = useRef<HTMLDivElement>(null);
  // The Shapes button shows the shape it draws (one of the gallery not in the menu: the rectangle).
  const quick = QUICK_SHAPES.find((s) => s.id === shape) ?? QUICK_SHAPES[0];
  const shapeOn = tool === "shape";

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !shapesRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const tip = (label: string, key: string) => (key ? `${t(label)} (${key})` : t(label));
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
      <button onClick={() => onChange("select")} aria-pressed={tool === "select"} title={tip("Select and move", "V")} className={toolBtn(tool === "select")}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 1.5l9.5 7.2-4.3.6 2.6 4.9-1.9 1-2.6-5-3.3 3z" />
        </svg>
      </button>

      <div ref={shapesRef} className="relative flex items-center">
        <button
          onClick={() => onPickShape(quick.id)}
          aria-pressed={shapeOn}
          title={tip(quick.label, quick.key)}
          data-testid="shape-tool"
          className={`${toolBtn(shapeOn)} rounded-e-none`}
        >
          <quick.Icon size={15} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-haspopup="menu"
          title={t("Shapes")}
          aria-label={t("Shapes")}
          data-testid="shape-menu"
          className={`grid h-7 w-3.5 place-items-center rounded-e-md transition-colors ${shapeOn ? "bg-indigo-500 text-white" : "text-muted hover:bg-black/5 hover:text-ink"}`}
        >
          <ChevronDown size={11} strokeWidth={2} aria-hidden />
        </button>
        {menu && (
          <div role="menu" className="absolute bottom-full left-0 mb-2 w-44 rounded-lg bg-neutral-900 py-1 text-[12px] text-white shadow-lg">
            {QUICK_SHAPES.map((s) => (
              <button
                key={s.id}
                role="menuitemradio"
                aria-checked={shapeOn && s.id === quick.id}
                onClick={() => {
                  onPickShape(s.id);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-start hover:bg-white/10"
              >
                <Check size={12} className={shapeOn && s.id === quick.id ? "" : "invisible"} aria-hidden />
                <s.Icon size={14} strokeWidth={1.75} aria-hidden />
                <span className="flex-1">{t(s.label)}</span>
                <span className="text-[11px] text-white/50">{s.key}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => onChange("textbox")} aria-pressed={tool === "textbox"} title={tip("Text box — drag on the page to draw one", "B")} className={toolBtn(tool === "textbox")}>
        <Type size={15} strokeWidth={1.75} aria-hidden />
      </button>

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

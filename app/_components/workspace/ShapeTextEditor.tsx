"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_COLOR, LINE_HEIGHT, SHAPE_FONT, textRect } from "@/app/_lib/shapes";
import { fontStack } from "@/app/_lib/fonts";
import type { ShapeBlock } from "@/app/_lib/types";

// Typing the text of a shape right on it: a plain text, in the shape's room for text, in its font, size, color and alignment, with no frame
// (the page leaves the shape's own text out meanwhile, see BlockNode). Enter starts a new line; Escape, Ctrl+Enter or a press elsewhere is done.
// It sits in the zoomed layer: its sizes are page pixels. The text's look is set for the whole shape in the right panel.
export default function ShapeTextEditor({ block, left, top, onChange, onDone }: {
  block: ShapeBlock;
  left: number; // x of the block on the page stack
  top: number;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const r = textRect(block, block.layout.width, block.layout.height);
  const size = block.fontSize ?? DEFAULT_FONT_SIZE;
  const valign = block.textVAlign ?? "middle";

  // the text when the editor opens, the cursor at its end (what is typed then is the editor's own: it is not written back into it)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = block.text ?? "";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // (only when another shape starts being typed in)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  // a press anywhere else ends the typing
  useEffect(() => {
    const down = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-text-format]") || ref.current?.contains(target)) return;
      onDone();
    };
    document.addEventListener("mousedown", down, true);
    return () => document.removeEventListener("mousedown", down, true);
  }, [onDone]);

  return (
    <div
      className="absolute z-20 flex flex-col"
      style={{ left: left + r.x, top: top + r.y, width: r.w, height: r.h, justifyContent: valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        ref={ref}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-testid="shape-text-editor"
        onInput={(e) => onChange(e.currentTarget.innerText.replace(/\n$/, ""))}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            onDone();
          }
        }}
        onBlur={() => setTimeout(() => !ref.current?.contains(document.activeElement) && onDone(), 0)}
        className="min-h-[1em] w-full cursor-text break-words whitespace-pre-wrap"
        style={{
          outline: "none",
          fontFamily: block.fontFamily ? fontStack(block.fontFamily) : SHAPE_FONT,
          fontSize: size,
          lineHeight: LINE_HEIGHT,
          fontWeight: block.bold ? 700 : 400,
          fontStyle: block.italic ? "italic" : "normal",
          color: block.textColor ?? DEFAULT_TEXT_COLOR,
          textAlign: block.textAlign ?? "center",
          caretColor: block.textColor ?? DEFAULT_TEXT_COLOR,
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ARROW_DEFAULT_WIDTH, LABEL_GAP, LABEL_SIZE, TEXT_SIZE } from "@/app/_lib/chemistry/geometry";
import type { CanvasAnnotation } from "@/app/_lib/chemistry/types";
import { useT } from "@/app/_lib/uiLang";
import type { View } from "@/app/_lib/chemistry/viewport";

const MIN_FONT_PX = 12;

interface Props {
  note: CanvasAnnotation;
  view: View;
  /** The text typed (Enter, or the field loses the focus), or null if the teacher gave up (Esc). */
  onDone: (text: string | null) => void;
}

// A field over the drawing, where a text or the conditions of an arrow are typed. It sits exactly where
// the text will be, at the zoom of the drawing. The text is typed plainly: "H2SO4" is drawn H₂SO₄.
export default function AnnotationEditor({ note, view, onDone }: Props) {
  const t = useT();
  const [value, setValue] = useState(note.text ?? "");
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false); // Enter and then the loss of the focus must not finish it twice

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(text);
  };

  const arrow = note.type === "arrow";
  const px = Math.max(MIN_FONT_PX, (arrow ? LABEL_SIZE : TEXT_SIZE) * view.scale);
  // the left edge of the text; an arrow's conditions are centred on the middle of the arrow, above it
  const left = view.x + (arrow ? note.x + (note.width ?? ARROW_DEFAULT_WIDTH) / 2 : note.x) * view.scale;
  const top = view.y + (arrow ? note.y - (LABEL_SIZE * 1.2 + LABEL_GAP) : note.y) * view.scale;

  return (
    <input
      ref={input}
      value={value}
      dir="auto"
      data-testid="annotation-editor"
      aria-label={arrow ? t("Conditions (H+, Δ…)") : t("Type a text")}
      placeholder={arrow ? t("Conditions (H+, Δ…)") : t("Type a text")}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value);
        } else if (e.key === "Escape") {
          e.preventDefault(); // marks the key as handled: the Studio must not close
          finish(null);
        }
        e.stopPropagation();
      }}
      onBlur={() => finish(value)}
      className="absolute rounded-md border border-accent bg-white/95 px-1.5 text-ink shadow-md outline-none"
      style={{
        left,
        top: top - 2,
        transform: arrow ? "translateX(-50%)" : undefined,
        width: Math.max(140, (value.length + 3) * px * 0.62),
        height: px * 1.5,
        fontSize: px,
        fontFamily: "Arial, Helvetica, sans-serif",
        userSelect: "text",
      }}
    />
  );
}

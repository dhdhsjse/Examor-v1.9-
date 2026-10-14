"use client";

import { useLayoutEffect, useRef } from "react";
import { editRegions, fieldKey, fieldValue, type EditField } from "@/app/_lib/editRegions";
import { isRtl } from "@/app/_lib/i18n";
import { FONT_FAMILY } from "@/app/_lib/measure";
import type { Block, Lang } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  block: Block;
  field: EditField;
  number: number;
  lang: Lang;
  top: number; // y of the block on the page stack
  onChange: (value: string) => void;
  onDone: () => void;
  onNext: (back: boolean) => void; // Tab: go to the next text of the block
  onEnter: () => void; // Enter in a list item (option, statement, part): add the next one
  selectAll: boolean; // select the starting text, so typing replaces it
}

// A text box placed exactly over a text of the page, so the teacher types "on the paper".
// It sits inside the zoomed layer, so its sizes are real page pixels.
// Fields where Enter adds a new item below (like a bullet list).
const LIST_FIELDS = ["option", "statement", "part"];

export default function InlineEditor({ block, field, number, lang, top, onChange, onDone, onNext, onEnter, selectAll }: Props) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const region = editRegions(block, number, lang).find((r) => fieldKey(r.field) === fieldKey(field));
  const value = fieldValue(block, field);

  // Grow with the text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, region?.width]);

  // Focus once, with the cursor at the end (or everything selected for a new block).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (selectAll) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
    // Only when another text starts being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, fieldKey(field)]);

  if (!region) return null;

  return (
    <textarea
      ref={ref}
      value={value}
      dir={isRtl(lang) ? "rtl" : "auto"}
      rows={1}
      spellCheck={false}
      placeholder={region.answer ? t("Model answer…") : t("Type here…")}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && LIST_FIELDS.includes(field.kind)) {
          e.preventDefault();
          onEnter();
        } else if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || (!region.multiline && !e.shiftKey)))) {
          e.preventDefault();
          onDone();
        } else if (e.key === "Tab") {
          e.preventDefault();
          onNext(e.shiftKey);
        }
      }}
      className="absolute z-20 resize-none overflow-hidden rounded-[3px] bg-white p-0 outline-2 outline-offset-2 outline-indigo-500 placeholder:text-slate-300"
      style={{
        left: block.layout.x + region.x,
        top: top + region.y,
        width: region.width,
        minHeight: region.line,
        fontFamily: FONT_FAMILY,
        fontSize: region.size,
        lineHeight: `${region.line}px`,
        fontWeight: region.bold ? 700 : 400,
        color: region.answer ? "#15803d" : "#111827",
        textAlign: region.align ?? (isRtl(lang) ? "right" : "left"),
        background: region.answer ? "#f0fdf4" : "#ffffff",
      }}
    />
  );
}

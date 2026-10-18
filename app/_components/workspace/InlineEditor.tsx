"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { editRegions, fieldKey, fieldValue, type EditField } from "@/app/_lib/editRegions";
import { isRtl } from "@/app/_lib/i18n";
import type { RunStyle } from "@/app/_lib/richText";
import type { Block, ExamMeta, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import FormatBar from "../rich/FormatBar";
import RichEditable, { type RichHandle } from "../rich/RichEditable";

interface Props {
  block: Block;
  field: EditField;
  number: number;
  meta: ExamMeta;
  mode: ViewMode;
  zoom: number;
  top: number; // y of the block on the page stack
  left: number; // x of the block on the page stack
  onChange: (value: string) => void;
  onDone: () => void;
  onNext: (back: boolean) => void; // Tab: go to the next text of the block
  onEnter: () => void; // Enter in a list item (option, statement, part): add the next one
  selectAll: boolean; // select the starting text, so typing replaces it
}

// Fields where Enter adds a new item below (like a bullet list).
const LIST_FIELDS = ["option", "statement", "part"];

// A text box placed exactly over a text of the page, so the teacher types "on the paper".
// It sits inside the zoomed layer, so its sizes are real page pixels. A format bar floats above it
// (screen size): select words to color / resize / change their font, or style the whole text.
export default function InlineEditor({ block, field, number, meta, mode, zoom, top, left, onChange, onDone, onNext, onEnter, selectAll }: Props) {
  const t = useT();
  const ref = useRef<RichHandle>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<RunStyle>({});
  const region = editRegions(block, number, meta, mode).find((r) => fieldKey(r.field) === fieldKey(field));
  const value = fieldValue(block, field);
  const rtl = isRtl(meta.lang);

  // Focus once, with the cursor at the end (or everything selected for a new block).
  useLayoutEffect(() => {
    ref.current?.focus(selectAll ? "all" : "end");
    // Only when another text starts being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, fieldKey(field)]);

  if (!region) return null;
  const { font, line } = region.spec;

  // Done when the focus leaves both the text and its format bar.
  const handleBlur = () =>
    setTimeout(() => {
      if (!wrap.current?.contains(document.activeElement)) onDone();
    }, 0);

  const x = left + region.x;
  const y = top + region.y;

  return (
    <div ref={wrap} onMouseDown={(e) => e.stopPropagation()} onBlur={handleBlur}>
      {/* Format bar just above the text, at screen size (lined up on the right in Arabic) */}
      <div className="absolute z-30 h-0" style={{ left: rtl ? x + region.width : x, top: y - 8 / zoom }}>
        <div className={`absolute bottom-0 ${rtl ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"}`} style={{ transform: `scale(${1 / zoom})` }}>
          <FormatBar
            style={sel}
            baseFont={block.font?.family ?? meta.fontFamily}
            baseSize={font.size}
            baseColor={font.color}
            onApply={(p) => ref.current?.apply(p)}
            onToggle={(k) => ref.current?.toggle(k)}
          />
        </div>
      </div>

      <RichEditable
        ref={ref}
        value={value}
        onChange={onChange}
        onSelectionStyle={setSel}
        multiline={region.multiline}
        dir={rtl ? "rtl" : "auto"}
        placeholder={region.answer ? t("Model answer…") : t("Type here…")}
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
        className="absolute z-20 rounded-[3px] outline-2 outline-offset-2 outline-indigo-500"
        style={{
          left: x,
          top: y,
          width: region.width,
          minHeight: line,
          fontFamily: font.family,
          fontSize: font.size,
          lineHeight: `${line}px`,
          fontWeight: font.bold ? 700 : 400,
          color: font.color,
          textAlign: region.align ?? (rtl ? "right" : "left"),
          background: region.answer ? "#fbfdfb" : "#ffffff",
        }}
      />
    </div>
  );
}

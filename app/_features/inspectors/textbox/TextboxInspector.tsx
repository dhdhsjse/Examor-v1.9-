"use client";

import { PaintBucket, Square } from "lucide-react";
import { useState } from "react";
import { Stepper } from "@/app/_components/inspector/fields";
import FormulaField from "@/app/_components/inspector/FormulaField";
import { useCurrentFormula } from "@/app/_lib/currentFormula";
import { BookmarkIcon, CopyIcon, TrashIcon } from "@/app/_components/icons";
import type { Ctx } from "@/app/_features/core/types";
import { useFormatTarget } from "@/app/_features/inspectors/format/formatTarget";
import { SpacingFields } from "@/app/_features/inspectors/format/ParagraphGroup";
import { ColorMenu, RibbonButton, RibbonGroup } from "@/app/_features/inspectors/format/ribbonUi";
import TextRibbon from "@/app/_features/inspectors/format/TextRibbon";
import { TEXTBOX_MAX_PAD, TEXTBOX_PAD, layoutTextbox, sizingAfterResize, textboxPad } from "@/app/_lib/blockLayout";
import { FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";
import type { TextboxBlock, TextboxSizing } from "@/app/_lib/types";

// The selected text box's ribbon, in place of its Properties (like Word's tab for a selected shape): its name and actions
// on one line, then the same ribbon as Home → Formatting (TextRibbon), on the selected words and paragraphs while the box
// is being typed in (its Tiptap editor on the page), else on the whole box; then the box's own settings (resizing, line and
// paragraph spacing, inner margin, dimensions, fill, border). It opens when a text box is selected (Feature.edits) and gives
// way when it no longer is.
export default function TextboxInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const b = shell.selected;
  const target = useFormatTarget(ctx, b);
  const formula = useCurrentFormula();
  if (b?.type !== "textbox" || !target) return <p className="text-sm text-muted">{t("Select a text box on the page.")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex items-center gap-0.5 border-b border-line pb-2.5">
        <h2 className="flex-1 ps-1 text-[13px] font-semibold text-ink">{t("Text box")}</h2>
        <RibbonButton title={t("Save to my library (reuse it in other exams)")} icon={<BookmarkIcon />} onClick={() => shell.saveToLibrary(b)} />
        <RibbonButton title={t("Duplicate")} shortcut="Ctrl+D" icon={<CopyIcon />} onClick={() => shell.duplicateBlock(b.id)} />
        <RibbonButton title={t("Delete")} shortcut="Del" icon={<TrashIcon />} onClick={() => shell.deleteBlock(b.id)} className="hover:bg-red-50! hover:text-red-600!" />
      </div>

      {/* A formula of the box is being edited: here too, like an equation. */}
      {formula && <FormulaField formula={formula} />}

      <TextRibbon ctx={ctx} b={b} target={target} ownSpacing>
        <RibbonGroup title={t("Box settings")}>
          <TextboxResizing ctx={ctx} b={b} />
          <SpacingFields t={t} para={target.para} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">{t("Inner margin")}</span>
            <Stepper
              value={Math.round(textboxPad(b))}
              min={0}
              max={TEXTBOX_MAX_PAD}
              title={t("Room between the edge of the box and its text (px)")}
              onChange={(v) => shell.updateBlock(b.id, { padding: v === TEXTBOX_PAD ? undefined : v }, "padding")}
            />
          </div>
          <TextboxDimensions ctx={ctx} b={b} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">{t("Fill and border")}</span>
            <div className="flex gap-0.5">
              <ColorMenu title={t("Fill color")} icon={<PaintBucket size={15} />} value={b.background} initial="#fef08a" autoLabel={t("No fill")} colors={FILL_COLORS} toggle onChange={(background) => shell.updateBlock(b.id, { background }, "background")} />
              <ColorMenu title={t("Border color")} icon={<Square size={15} />} value={b.border} initial="#111827" autoLabel={t("No border")} colors={TEXT_COLORS} toggle onChange={(border) => shell.updateBlock(b.id, { border }, "border")} />
            </div>
          </div>
        </RibbonGroup>
      </TextRibbon>
    </div>
  );
}

const SIZINGS: { id: TextboxSizing; label: string; icon: React.ReactNode }[] = [
  {
    id: "auto-width",
    label: "Auto width — as wide and as tall as the text",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2.5 4v8M5.5 8h8M11 5.5 13.5 8 11 10.5" />
      </svg>
    ),
  },
  {
    id: "auto-height",
    label: "Auto height — the width you give it, as tall as the text",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
        <path d="M2.5 3v10M13.5 3v10M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
      </svg>
    ),
  },
  {
    id: "fixed",
    label: "Fixed size — the size you give it (taller only if the text needs it)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
        <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
        <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" />
      </svg>
    ),
  },
];

// Resizing, as in Figma: the box follows its text (auto width, auto height) or keeps the size given (fixed).
function TextboxResizing({ ctx, b }: { ctx: Ctx; b: TextboxBlock }) {
  const { t, shell } = ctx;
  const sizing = b.sizing ?? "fixed";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted">{t("Resizing")}</span>
      <div role="radiogroup" aria-label={t("Resizing")} className="flex rounded-md bg-subtle p-0.5">
        {SIZINGS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={sizing === s.id}
            title={t(s.label)}
            aria-label={t(s.label)}
            data-testid={`sizing-${s.id}`}
            onClick={() => shell.updateBlock(b.id, { sizing: s.id === "fixed" ? undefined : s.id }, "sizing")}
            className={`grid h-6 w-8 place-items-center rounded transition-colors ${sizing === s.id ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}
          >
            {s.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// The width and height typed in. Typing a size, like dragging an edge, gives up the automatic size that it changes.
function TextboxDimensions({ ctx, b }: { ctx: Ctx; b: TextboxBlock }) {
  const { t, shell, doc } = ctx;
  const height = Math.round(layoutTextbox(b, doc.meta).height);
  const resize = (size: { width?: number; height?: number }) => {
    const next = sizingAfterResize(b, doc.meta, size);
    shell.updateBlock(b.id, { layout: size, ...(next !== b.sizing ? { sizing: next } : {}) }, "size");
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="me-auto text-[11px] text-muted">{t("Dimensions")}</span>
      <SizeInput label="W" title={t("Width (px)")} value={Math.round(b.layout.width)} min={40} onCommit={(width) => resize({ width })} />
      <SizeInput label="H" title={t("Height (px)")} value={height} min={30} onCommit={(h) => resize({ height: h })} />
    </div>
  );
}

// A size typed in: kept when Enter is pressed or the field is left (a number under `min` becomes `min`).
function SizeInput({ label, title, value, min, onCommit }: { label: string; title: string; value: number; min: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const v = Math.round(Number(draft));
    setDraft(null);
    if (draft !== null && Number.isFinite(v) && v !== value) onCommit(Math.max(min, Math.min(5000, v)));
  };
  return (
    <label title={title} className="flex h-7 w-[72px] items-center gap-1 rounded-md bg-subtle px-2 text-xs focus-within:ring-1 focus-within:ring-indigo-300">
      <span className="text-faint">{label}</span>
      <input
        inputMode="numeric"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        aria-label={title}
        className="w-full min-w-0 bg-transparent text-ink outline-none"
      />
    </label>
  );
}

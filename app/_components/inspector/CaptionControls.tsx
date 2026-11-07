"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, type LucideIcon } from "lucide-react";
import { CAPTION_MAX_SIZE, CAPTION_MIN_SIZE, DEFAULT_SIZE, defaultCaptionSize } from "@/app/_lib/blockLayout";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import type { CaptionStyle, ExamMeta, ImageBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid, FontSelect } from "../rich/FormatBar";
import { Stepper, TextAction, iconButtonCls, inputCls } from "./fields";
import type { OnChange } from "./QuestionEditors";

const selectCls = `${inputCls} h-7 flex-1 truncate`;

// A small square button that is on or off (bold, italic, an alignment…).
function ToggleIcon({ icon: Icon, on, label, onClick }: { icon: LucideIcon; on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={on} onClick={onClick} className={`${iconButtonCls} ${on ? "bg-accent-soft! text-accent!" : ""}`}>
      <Icon size={14} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

// The caption's own little toolbar, under its text in the Caption group: font and size, bold / italic / underline, alignment, color.
export function CaptionControls({ b, meta, onChange }: { b: ImageBlock; meta?: ExamMeta; onChange: OnChange }) {
  const t = useT();
  const c = b.captionStyle ?? {};
  const set = (patch: Partial<CaptionStyle>) => {
    const next = { ...c, ...patch };
    for (const k of Object.keys(next) as (keyof CaptionStyle)[]) if (next[k] === undefined) delete next[k];
    onChange({ captionStyle: Object.keys(next).length ? next : undefined }, "captionStyle");
  };
  const size = c.size ?? (meta ? defaultCaptionSize(meta) : DEFAULT_SIZE - 2);
  const italic = c.italic ?? true;
  const align = c.align ?? "center";
  const changed = Object.keys(c).length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <FontSelect value={c.family} onChange={(family) => set({ family })} defaultLabel={`${t("Exam font")} (${meta?.fontFamily ?? DEFAULT_FONT})`} className={selectCls} />
        <Stepper value={size} min={CAPTION_MIN_SIZE} max={CAPTION_MAX_SIZE} onChange={(v) => set({ size: v })} title={t("Font size")} />
      </div>
      <div className="flex items-center gap-0.5">
        <ToggleIcon icon={Bold} label={t("Bold")} on={!!c.bold} onClick={() => set({ bold: c.bold ? undefined : true })} />
        <ToggleIcon icon={Italic} label={t("Italic")} on={italic} onClick={() => set({ italic: italic ? false : undefined })} />
        <ToggleIcon icon={Underline} label={t("Underline")} on={!!c.underline} onClick={() => set({ underline: c.underline ? undefined : true })} />
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <ToggleIcon icon={AlignLeft} label={t("Align left")} on={align === "left"} onClick={() => set({ align: "left" })} />
        <ToggleIcon icon={AlignCenter} label={t("Center")} on={align === "center"} onClick={() => set({ align: undefined })} />
        <ToggleIcon icon={AlignRight} label={t("Align right")} on={align === "right"} onClick={() => set({ align: "right" })} />
        {changed && (
          <span className="ms-auto">
            <TextAction onClick={() => onChange({ captionStyle: undefined }, "captionStyle")}>{t("Reset")}</TextAction>
          </span>
        )}
      </div>
      <ColorGrid value={c.color} autoLabel={t("Auto")} onChange={(color) => set({ color })} />
    </div>
  );
}

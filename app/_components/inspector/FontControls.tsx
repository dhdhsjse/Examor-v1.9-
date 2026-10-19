"use client";

import { DEFAULT_SIZE, textSpec } from "@/app/_lib/blockLayout";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import type { Block, BlockFont, ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid, FontSelect } from "../rich/FormatBar";
import { Stepper } from "./fields";
import type { OnChange } from "./QuestionEditors";

const TEXT_TYPES: Block["type"][] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify", "text", "textbox", "table", "header"];
export const hasFontControls = (b: Block) => TEXT_TYPES.includes(b.type);

const selectCls = "w-full rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-indigo-400";

// "Text style" of the whole block: font, size, color. Single words are styled on the page.
export function BlockFontControls({ b, meta, onChange }: { b: Block; meta: ExamMeta; onChange: OnChange }) {
  const t = useT();
  const font = b.font ?? {};
  const set = (patch: Partial<BlockFont>) => {
    const next = { ...font, ...patch };
    for (const k of Object.keys(next) as (keyof BlockFont)[]) if (next[k] === undefined) delete next[k];
    onChange({ font: Object.keys(next).length ? next : undefined }, "font");
  };
  const size = b.type === "text" ? textSpec(b, meta).font.size : (font.size ?? meta.fontSize ?? DEFAULT_SIZE);
  const header = b.type === "header";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-subtle/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted">{t("Text style")}</span>
        {(font.family || font.size || font.color) && (
          <button type="button" onClick={() => onChange({ font: undefined }, "font")} className="text-[10px] text-indigo-600 hover:underline">
            {t("Reset")}
          </button>
        )}
      </div>
      <FontSelect value={font.family} onChange={(family) => set({ family })} defaultLabel={`${t("Exam font")} (${meta.fontFamily ?? DEFAULT_FONT})`} className={selectCls} />
      {!header && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">{t("Size")}</span>
            <Stepper value={size} min={8} max={60} onChange={(v) => set({ size: v })} title={t("Font size")} />
          </div>
          <ColorGrid value={font.color} autoLabel={t("Auto")} onChange={(color) => set({ color })} />
        </>
      )}
      <p className="text-[10px] leading-snug text-faint">{t("To style only some words: click the text on the page, select the words and use the bar above them.")}</p>
    </div>
  );
}

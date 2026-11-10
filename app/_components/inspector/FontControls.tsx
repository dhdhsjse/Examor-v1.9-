"use client";

import { DEFAULT_SIZE, textSpec } from "@/app/_lib/blockLayout";
import { COMMON_COLORS, DEFAULT_FONT } from "@/app/_lib/fonts";
import { isFixedTable } from "@/app/_lib/table";
import type { Block, BlockFont, ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid, FontSelect } from "../rich/FormatBar";
import { Group, Stepper, TextAction, inputCls } from "./fields";
import type { OnChange } from "./QuestionEditors";

const TEXT_TYPES: Block["type"][] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify", "text", "textbox", "table", "header"];
// (a table with shapes or pictures is fixed like a picture: its font is changed in the Table Studio)
export const hasFontControls = (b: Block) => TEXT_TYPES.includes(b.type) && !(b.type === "table" && isFixedTable(b));

// "Text style" of the whole block: font and size on one line, then the color. Single words are styled on the page.
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
  const changed = !!(font.family || font.size || font.color);

  return (
    <Group title={t("Text style")} action={changed && <TextAction onClick={() => onChange({ font: undefined }, "font")}>{t("Reset")}</TextAction>}>
      <div className="flex items-center gap-1.5">
        <FontSelect value={font.family} onChange={(family) => set({ family })} defaultLabel={`${t("Exam font")} (${meta.fontFamily ?? DEFAULT_FONT})`} className={`${inputCls} h-7 flex-1 truncate`} />
        {!header && <Stepper value={size} min={8} max={60} onChange={(v) => set({ size: v })} title={t("Font size")} />}
      </div>
      {!header && <ColorGrid value={font.color} autoLabel={t("Auto")} colors={b.type === "table" ? COMMON_COLORS : undefined} onChange={(color) => set({ color })} />}
    </Group>
  );
}

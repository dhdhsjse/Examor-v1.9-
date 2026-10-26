"use client";

import type { ReactNode } from "react";
import { isRtl } from "@/app/_lib/i18n";
import { DEFAULT_ACCENT } from "@/app/_lib/blockLayout";
import { docFromRich } from "@/app/_lib/textboxDoc";
import type { HeaderBlock, HeaderFields, HeaderStyle, HeadingDecor, ImageBlock, Lang, TableBlock, TextBlock, TextboxBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { HEADER_STYLE_OPTIONS, HeaderSketch } from "../HeaderSketch";
import { ColorGrid } from "../rich/FormatBar";
import { FigureEditor } from "./FigureEditor";
import { ChoiceGrid, Field, NumberInput, RichInput, Segmented, SmallButton, TextInput } from "./fields";
import type { OnChange } from "./QuestionEditors";

// A text box: its text, and where it sits in the box. Font, size and alignment: Home → Formatting.
export function TextboxEditor({ b, onChange }: { b: TextboxBlock; onChange: OnChange }) {
  const t = useT();
  return (
    <>
      <Field label={t("Text")}>
        <RichInput value={b.text} onChange={(text) => onChange({ text, content: docFromRich(text) }, "text")} rows={5} multiline />
      </Field>
      <Field label={t("In the box")}>
        <Segmented
          value={b.valign ?? "top"}
          onChange={(valign) => onChange({ valign }, "valign")}
          options={[
            { value: "top", label: t("Top") },
            { value: "middle", label: t("Middle") },
            { value: "bottom", label: t("Bottom") },
          ]}
        />
      </Field>
      <p className="text-[11px] leading-snug text-faint">{t("Drag the handles of the box to change its size. Font, size and alignment: Home → Formatting.")}</p>
    </>
  );
}

export function TextEditor({ b, onChange }: { b: TextBlock; onChange: OnChange }) {
  const t = useT();
  return (
    <>
      <Field label={t("Style")}>
        <Segmented
          value={b.style}
          onChange={(style) => onChange({ style }, "style")}
          options={[
            { value: "title", label: t("Title") },
            { value: "heading", label: t("Heading") },
            { value: "body", label: t("Paragraph") },
          ]}
        />
      </Field>
      {b.style !== "body" && (
        <>
          <Field label={t("Look")}>
            <ChoiceGrid value={b.decor ?? "plain"} onChange={(decor) => onChange({ decor }, "decor")} options={decorOptions(t, b.accent ?? DEFAULT_ACCENT)} />
          </Field>
          {(b.decor ?? "plain") !== "plain" && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted">{t("Accent color")}</span>
              <ColorGrid value={b.accent ?? DEFAULT_ACCENT} onChange={(accent) => onChange({ accent }, "accent")} />
            </div>
          )}
        </>
      )}
      <Field label={t("Text")} hint={t("Tip: click the text on the page and type there.")}>
        <RichInput value={b.text} onChange={(text) => onChange({ text }, "text")} rows={5} multiline={b.style === "body"} />
      </Field>
    </>
  );
}

export function TableEditor({ b, lang, onChange }: { b: TableBlock; lang: Lang; onChange: OnChange }) {
  const t = useT();
  const rows = b.cells.length;
  const cols = b.cells[0]?.length ?? 1;
  const setCell = (r: number, c: number, v: string) =>
    onChange({ cells: b.cells.map((row, i) => (i === r ? row.map((x, k) => (k === c ? v : x)) : row)) }, `cell${r}-${c}`);
  // New size: keep the custom widths/heights that still apply.
  const resize = (nr: number, nc: number) => {
    const cells = Array.from({ length: nr }, (_, r) => Array.from({ length: nc }, (_, c) => b.cells[r]?.[c] ?? ""));
    const colWidths = nc === cols ? b.colWidths : undefined;
    const rowHeights = b.rowHeights ? Array.from({ length: nr }, (_, r) => b.rowHeights?.[r] ?? 0) : undefined;
    onChange({ cells, colWidths, rowHeights }, "size");
  };
  const custom = !!b.colWidths || !!b.rowHeights?.some((h) => h > 0);

  return (
    <>
      <div className="flex gap-4">
        <Field label={t("Rows")}>
          <NumberInput value={rows} min={1} max={20} onChange={(n) => resize(n, cols)} />
        </Field>
        <Field label={t("Columns")}>
          <NumberInput value={cols} min={1} max={8} onChange={(n) => resize(rows, n)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={b.header} onChange={(e) => onChange({ header: e.target.checked }, "header")} className="accent-indigo-600" />
        {t("First row is a header (bold)")}
      </label>
      <p className="rounded-md bg-indigo-50/70 px-2.5 py-2 text-[11px] leading-snug text-indigo-900">
        {t("Drag the lines of the table on the page to change the width of the columns and the height of the rows.")}
      </p>
      {custom && <SmallButton onClick={() => onChange({ colWidths: undefined, rowHeights: undefined }, "sizes")}>{t("Equal columns, automatic rows")}</SmallButton>}
      <Field label={t("Cells")} hint={isRtl(lang) ? t("Arabic exam: the first column is on the right, like on the paper.") : undefined}>
        <div className="overflow-x-auto">
          {/* Same direction as the paper, so each box sits where its cell is printed */}
          <div className="grid gap-1" dir={isRtl(lang) ? "rtl" : "ltr"} style={{ gridTemplateColumns: `repeat(${cols}, minmax(64px, 1fr))` }}>
            {b.cells.map((row, r) =>
              row.map((cell, c) => (
                <div key={`${r}-${c}`} className={`min-w-0 text-xs [&_.rich-edit]:px-1.5 [&_.rich-edit]:py-1 [&_.rich-edit]:text-xs ${b.header && r === 0 ? "font-semibold" : ""}`}>
                  <RichInput value={cell} onChange={(v) => setCell(r, c, v)} />
                </div>
              )),
            )}
          </div>
        </div>
      </Field>
    </>
  );
}

export function ImageEditor({ b, lang, onChange, onReplace }: { b: ImageBlock; lang: Lang; onChange: OnChange; onReplace: () => void }) {
  const t = useT();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
      <img src={b.src} alt="" className="max-h-40 w-full rounded-md border border-line bg-subtle object-contain" />
      {b.figure && <FigureEditor b={b} figure={b.figure} lang={lang} onChange={onChange} />}
      <Field label={t("Width (px)")} hint={t("Height follows to keep the picture's shape. You can also drag the corner handles.")}>
        <NumberInput
          value={Math.round(b.layout.width)}
          min={40}
          max={794}
          onChange={(width) => onChange({ layout: { width, height: width / b.ratio } }, "width")}
        />
      </Field>
      {/* A figure is redrawn from its settings, a molecule or a drawing from its data: replacing it with a picture drops them. */}
      <SmallButton onClick={onReplace}>{t(b.figure || b.molecule || b.drawing || b.graphStudio || b.circuitStudio ? "Replace with an image…" : "Replace image…")}</SmallButton>
    </>
  );
}

// Header styles drawn in their own color (the teacher can change it).
export const COLORED: HeaderStyle[] = ["modern", "banner", "elegant", "split", "cards", "playful", "evaluation", "official", "compact",
  "accentbar", "bookmark", "gradient", "geometric", "chips", "editorial", "framed", "infogrid", "duotone", "monogram", "ticket", "floating"];

export function HeaderEditor({ b, totalPoints, onChange }: { b: HeaderBlock; totalPoints: number; onChange: OnChange }) {
  const t = useT();
  const set = (key: keyof HeaderFields, value: string | number | boolean) => onChange({ fields: { ...b.fields, [key]: value } }, `field-${key}`);
  const text = (key: Exclude<keyof HeaderFields, "outOf" | "autoOutOf">, label: string) => (
    <Field label={label}>
      <TextInput value={b.fields[key] ?? ""} onChange={(v) => set(key, v)} />
    </Field>
  );
  const auto = !!b.fields.autoOutOf;
  const mismatch = !auto && totalPoints > 0 && totalPoints !== b.fields.outOf;

  return (
    <>
      <Field group label={t("Header style")}>
        <ChoiceGrid<HeaderStyle>
          value={b.style}
          onChange={(style) => onChange({ style }, "style")}
          options={HEADER_STYLE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label), preview: <HeaderSketch style={o.value} accent={b.accent} /> }))}
        />
      </Field>
      {COLORED.includes(b.style) && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">{t("Color")}</span>
          <ColorGrid value={b.accent} autoLabel={t("Style's own")} onChange={(accent) => onChange({ accent }, "accent")} />
        </div>
      )}
      {b.style === "official" && text("authority", t("Ministry / authority line"))}
      {text("title", t("Exam title"))}
      {text("school", t("School"))}
      {text("subject", t("Subject"))}
      {text("level", t("Level / class"))}
      {text("duration", t("Duration"))}
      {text("year", t("School year"))}

      <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-subtle/60 p-2.5">
        <span className="text-[11px] font-semibold text-muted">{t("Graded out of")}</span>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={auto} onChange={(e) => set("autoOutOf", e.target.checked)} className="accent-indigo-600" />
          {t("Use the total of the questions ({n} pts)", { n: totalPoints })}
        </label>
        {auto ? (
          <p className="text-[10px] leading-snug text-faint">
            {totalPoints > 0 ? t("The score follows the points of the questions.") : t("No points yet: /{n} is shown until you add questions.", { n: b.fields.outOf })}
          </p>
        ) : (
          <NumberInput value={b.fields.outOf} min={1} max={100} onChange={(v) => set("outOf", v)} />
        )}
        {mismatch && (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800 ring-1 ring-amber-200">
            {t("The questions add up to {total} pts, not {outOf}.", { total: totalPoints, outOf: b.fields.outOf })}
          </p>
        )}
      </div>
    </>
  );
}

type Tr = ReturnType<typeof useT>;

// The heading looks, each with a small drawing in the chosen accent color.
function decorOptions(t: Tr, accent: string): { value: HeadingDecor; label: string; preview: ReactNode }[] {
  const word = <span className="text-[10px] font-bold text-ink">Exercice 1</span>;
  return [
    { value: "plain", label: t("Plain"), preview: word },
    { value: "underline", label: t("Underline"), preview: <span className="border-b-[3px] pb-px text-[10px] font-bold text-ink" style={{ borderColor: accent }}>Exercice 1</span> },
    { value: "bar", label: t("Side bar"), preview: <span className="border-s-[3px] ps-1 text-[10px] font-bold text-ink" style={{ borderColor: accent }}>Exercice 1</span> },
    { value: "band", label: t("Band"), preview: <span className="w-full rounded px-1.5 py-1 text-start text-[10px] font-bold text-white" style={{ background: accent }}>Exercice 1</span> },
    { value: "pill", label: t("Pill"), preview: <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: accent }}>Exercice 1</span> },
    { value: "boxed", label: t("Box"), preview: <span className="w-full rounded border-[1.5px] px-1.5 py-0.5 text-start text-[10px] font-bold text-ink" style={{ borderColor: accent, background: `${accent}14` }}>Exercice 1</span> },
    {
      value: "rule",
      label: t("Line"),
      preview: (
        <span className="flex w-full items-center gap-1 px-1">
          {word}
          <span className="h-px flex-1" style={{ background: accent }} />
        </span>
      ),
    },
  ];
}

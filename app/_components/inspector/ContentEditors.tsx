"use client";

import { isRtl } from "@/app/_lib/i18n";
import type { HeaderBlock, HeaderFields, ImageBlock, Lang, TableBlock, TextBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { Field, NumberInput, Segmented, SmallButton, TextArea, TextInput } from "./fields";
import type { OnChange } from "./QuestionEditors";

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
      <Field label={t("Text")} hint={t("Tip: click the text on the page and type there.")}>
        <TextArea value={b.text} onChange={(text) => onChange({ text }, "text")} rows={5} />
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
                <input
                  key={`${r}-${c}`}
                  dir="auto"
                  value={cell}
                  onChange={(e) => setCell(r, c, e.target.value)}
                  className={`rounded border border-line px-1.5 py-1 text-xs outline-none focus:border-indigo-400 ${b.header && r === 0 ? "bg-subtle font-semibold" : "bg-white"}`}
                />
              )),
            )}
          </div>
        </div>
      </Field>
    </>
  );
}

export function ImageEditor({ b, onChange, onReplace }: { b: ImageBlock; onChange: OnChange; onReplace: () => void }) {
  const t = useT();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
      <img src={b.src} alt="" className="max-h-40 w-full rounded-md border border-line bg-subtle object-contain" />
      <Field label={t("Width (px)")} hint={t("Height follows to keep the picture's shape. You can also drag the corner handles.")}>
        <NumberInput
          value={Math.round(b.layout.width)}
          min={40}
          max={794}
          onChange={(width) => onChange({ layout: { width, height: width / b.ratio } }, "width")}
        />
      </Field>
      <SmallButton onClick={onReplace}>{t("Replace image…")}</SmallButton>
    </>
  );
}

export function HeaderEditor({ b, totalPoints, onChange }: { b: HeaderBlock; totalPoints: number; onChange: OnChange }) {
  const t = useT();
  const set = (key: keyof HeaderFields, value: string | number | boolean) => onChange({ fields: { ...b.fields, [key]: value } }, `field-${key}`);
  const text = (key: Exclude<keyof HeaderFields, "outOf" | "autoOutOf">, label: string) => (
    <Field label={label}>
      <TextInput value={b.fields[key]} onChange={(v) => set(key, v)} />
    </Field>
  );
  const auto = !!b.fields.autoOutOf;
  const mismatch = !auto && totalPoints > 0 && totalPoints !== b.fields.outOf;

  return (
    <>
      <Field label={t("Header style")}>
        <Segmented
          value={b.style}
          onChange={(style) => onChange({ style }, "style")}
          options={[
            { value: "classic", label: t("Classic") },
            { value: "modern", label: t("Modern") },
            { value: "minimal", label: t("Minimal") },
          ]}
        />
      </Field>
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

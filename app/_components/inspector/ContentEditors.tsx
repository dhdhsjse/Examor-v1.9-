"use client";

import type { HeaderBlock, HeaderFields, ImageBlock, TableBlock, TextBlock } from "@/app/_lib/types";
import { Field, NumberInput, Segmented, SmallButton, TextArea, TextInput } from "./fields";
import type { OnChange } from "./QuestionEditors";

export function TextEditor({ b, onChange }: { b: TextBlock; onChange: OnChange }) {
  return (
    <>
      <Field label="Style">
        <Segmented
          value={b.style}
          onChange={(style) => onChange({ style }, "style")}
          options={[
            { value: "title", label: "Title" },
            { value: "heading", label: "Heading" },
            { value: "body", label: "Paragraph" },
          ]}
        />
      </Field>
      <Field label="Text">
        <TextArea value={b.text} onChange={(text) => onChange({ text }, "text")} rows={5} />
      </Field>
    </>
  );
}

export function TableEditor({ b, onChange }: { b: TableBlock; onChange: OnChange }) {
  const rows = b.cells.length;
  const cols = b.cells[0]?.length ?? 1;
  const setCell = (r: number, c: number, v: string) =>
    onChange({ cells: b.cells.map((row, i) => (i === r ? row.map((x, k) => (k === c ? v : x)) : row)) }, `cell${r}-${c}`);
  const resize = (nr: number, nc: number) => {
    const cells = Array.from({ length: nr }, (_, r) => Array.from({ length: nc }, (_, c) => b.cells[r]?.[c] ?? ""));
    onChange({ cells }, "size");
  };

  return (
    <>
      <div className="flex gap-4">
        <Field label="Rows">
          <NumberInput value={rows} min={1} max={20} onChange={(n) => resize(n, cols)} />
        </Field>
        <Field label="Columns">
          <NumberInput value={cols} min={1} max={8} onChange={(n) => resize(rows, n)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={b.header} onChange={(e) => onChange({ header: e.target.checked }, "header")} className="accent-indigo-600" />
        First row is a header (bold)
      </label>
      <Field label="Cells">
        <div className="overflow-x-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(64px, 1fr))` }}>
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
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
      <img src={b.src} alt="" className="max-h-40 w-full rounded-md border border-line bg-subtle object-contain" />
      <Field label="Width (px)" hint="Height follows to keep the picture's shape. You can also drag the corner handles.">
        <NumberInput
          value={Math.round(b.layout.width)}
          min={40}
          max={794}
          onChange={(width) => onChange({ layout: { width, height: width / b.ratio } }, "width")}
        />
      </Field>
      <SmallButton onClick={onReplace}>Replace image…</SmallButton>
    </>
  );
}

export function HeaderEditor({ b, onChange }: { b: HeaderBlock; onChange: OnChange }) {
  const set = (key: keyof HeaderFields, value: string | number) => onChange({ fields: { ...b.fields, [key]: value } }, `field-${key}`);
  const text = (key: Exclude<keyof HeaderFields, "outOf">, label: string) => (
    <Field label={label}>
      <TextInput value={b.fields[key]} onChange={(v) => set(key, v)} />
    </Field>
  );

  return (
    <>
      <Field label="Header style">
        <Segmented
          value={b.style}
          onChange={(style) => onChange({ style }, "style")}
          options={[
            { value: "classic", label: "Classic" },
            { value: "modern", label: "Modern" },
            { value: "minimal", label: "Minimal" },
          ]}
        />
      </Field>
      {text("title", "Exam title")}
      {text("school", "School")}
      {text("subject", "Subject")}
      {text("level", "Level / class")}
      {text("duration", "Duration")}
      {text("year", "School year")}
      <Field label="Graded out of">
        <NumberInput value={b.fields.outOf} min={1} max={100} onChange={(v) => set("outOf", v)} />
      </Field>
    </>
  );
}

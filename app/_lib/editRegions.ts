// Which parts of a block can be typed in directly on the page, and where they are.
// Used by the canvas (double-click / text tool) and by the inline text box.

import {
  BODY,
  CHOICE_W,
  PAD,
  TEXT_STYLES,
  TITLE,
  layoutBlank,
  layoutMcq,
  layoutOpen,
  layoutTable,
  layoutText,
  layoutTrueFalse,
  type AnswerArea,
} from "./blockLayout";
import { isRtl } from "./i18n";
import type { Block, Lang, OpenPart } from "./types";
import type { BlockPatch } from "./useExam";

export type EditField =
  | { kind: "text" } // question text, or the text of a text block
  | { kind: "option"; i: number }
  | { kind: "statement"; i: number }
  | { kind: "content" } // fill-in-the-blank sentence
  | { kind: "answer" } // model answer of an open question
  | { kind: "part"; i: number } // sub-question text
  | { kind: "partAnswer"; i: number }
  | { kind: "cell"; r: number; c: number };

// A rectangle (block coordinates) + how its text looks.
export interface EditRegion {
  field: EditField;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  line: number;
  bold: boolean;
  answer?: boolean; // shown in green (correction)
  multiline: boolean; // Enter = new line (otherwise Enter = done)
  align?: "left" | "right" | "center";
}

// A spot you click to set the correct answer (MCQ circle, True/False box).
export interface ClickTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  patch: BlockPatch;
}

export const fieldKey = (f: EditField) => JSON.stringify(f);

const body = { size: BODY.size, line: BODY.line, bold: false };
const answerRegion = (field: EditField, a: AnswerArea): EditRegion => ({
  field,
  x: a.x,
  y: a.y - 4,
  width: a.width,
  height: Math.max(a.height, 24),
  size: BODY.size,
  line: 28,
  bold: false,
  answer: true,
  multiline: true,
});

export function editRegions(b: Block, n: number, lang: Lang): EditRegion[] {
  const w = b.layout.width;
  const rtl = isRtl(lang);
  const title = (t: { y: number; height: number }): EditRegion => ({
    field: { kind: "text" },
    x: PAD,
    y: t.y,
    width: w - PAD * 2,
    height: t.height,
    size: TITLE.size,
    line: TITLE.line,
    bold: true,
    multiline: false,
  });

  switch (b.type) {
    case "mcq": {
      const L = layoutMcq(b, n, lang);
      return [
        title(L.title),
        ...L.options.map((o, i) => ({ field: { kind: "option", i } as EditField, x: rtl ? PAD : PAD + 30, y: o.y, width: w - PAD * 2 - 30, height: o.height, ...body, multiline: false })),
      ];
    }
    case "truefalse": {
      const L = layoutTrueFalse(b, n, lang);
      return [
        title(L.title),
        ...L.rows.map((r, i) => ({
          field: { kind: "statement", i } as EditField,
          x: rtl ? PAD + CHOICE_W + 10 : PAD,
          y: r.y,
          width: w - PAD * 2 - CHOICE_W - 10,
          height: r.height,
          ...body,
          multiline: false,
        })),
      ];
    }
    case "blank": {
      const L = layoutBlank(b, n, lang);
      return [title(L.title), { field: { kind: "content" }, x: PAD, y: L.exam.y, width: w - PAD * 2, height: Math.max(L.exam.height, L.key.height), ...body, multiline: true }];
    }
    case "open": {
      const L = layoutOpen(b, n, lang);
      const out: EditRegion[] = [title(L.title)];
      if (L.main.count > 0) out.push(answerRegion({ kind: "answer" }, L.main));
      L.parts.forEach((p, i) => {
        out.push({ field: { kind: "part", i }, x: p.area.x, y: p.text.y, width: p.area.width, height: p.text.height, ...body, multiline: false });
        if (p.area.count > 0) out.push(answerRegion({ kind: "partAnswer", i }, p.area));
      });
      return out;
    }
    case "text": {
      const L = layoutText(b);
      const s = TEXT_STYLES[b.style];
      return [
        {
          field: { kind: "text" },
          x: PAD,
          y: L.text.y,
          width: w - PAD * 2,
          height: L.text.height,
          size: s.size,
          line: s.line,
          bold: s.bold,
          multiline: b.style === "body",
          align: b.style === "title" ? "center" : undefined,
        },
      ];
    }
    case "table": {
      const L = layoutTable(b);
      const colLeft = (c: number) => (rtl ? w - (c + 1) * L.colW : c * L.colW);
      return L.rows.flatMap((row, r) =>
        row.cells.map((_, c) => ({
          field: { kind: "cell", r, c } as EditField,
          x: colLeft(c) + 6,
          y: row.y + 4,
          width: L.colW - 12,
          height: row.height - 8,
          size: BODY.size,
          line: BODY.line,
          bold: row.bold,
          multiline: false,
          align: row.bold ? ("center" as const) : undefined,
        })),
      );
    }
    default:
      return [];
  }
}

export function clickTargets(b: Block, n: number, lang: Lang): ClickTarget[] {
  const w = b.layout.width;
  const rtl = isRtl(lang);
  if (b.type === "mcq") {
    return layoutMcq(b, n, lang).options.map((o, i) => ({ x: rtl ? w - PAD - 20 : PAD - 2, y: o.y, width: 22, height: BODY.line, patch: { correct: i } }));
  }
  if (b.type === "truefalse") {
    const colX = rtl ? PAD : w - PAD - CHOICE_W;
    const half = CHOICE_W / 2;
    return layoutTrueFalse(b, n, lang).rows.flatMap((r, i) =>
      [true, false].map((value, k) => ({
        x: rtl ? colX + CHOICE_W - (k + 1) * half : colX + k * half,
        y: r.y,
        width: half,
        height: 22,
        patch: { statements: b.statements.map((s, j) => (j === i ? { ...s, answer: value } : s)) },
      })),
    );
  }
  return [];
}

export function fieldValue(b: Block, f: EditField): string {
  switch (f.kind) {
    case "text":
      return "text" in b ? b.text : "";
    case "option":
      return b.type === "mcq" ? (b.options[f.i] ?? "") : "";
    case "statement":
      return b.type === "truefalse" ? (b.statements[f.i]?.text ?? "") : "";
    case "content":
      return b.type === "blank" ? b.content : "";
    case "answer":
      return b.type === "open" ? b.answer : "";
    case "part":
      return b.type === "open" ? (b.parts?.[f.i]?.text ?? "") : "";
    case "partAnswer":
      return b.type === "open" ? (b.parts?.[f.i]?.answer ?? "") : "";
    case "cell":
      return b.type === "table" ? (b.cells[f.r]?.[f.c] ?? "") : "";
  }
}

const setPart = (parts: OpenPart[], i: number, patch: Partial<OpenPart>) => parts.map((p, k) => (k === i ? { ...p, ...patch } : p));

export function fieldPatch(b: Block, f: EditField, v: string): BlockPatch {
  switch (f.kind) {
    case "text":
      return { text: v } as BlockPatch;
    case "option":
      return b.type === "mcq" ? { options: b.options.map((o, k) => (k === f.i ? v : o)) } : {};
    case "statement":
      return b.type === "truefalse" ? { statements: b.statements.map((s, k) => (k === f.i ? { ...s, text: v } : s)) } : {};
    case "content":
      return { content: v };
    case "answer":
      return { answer: v };
    case "part":
      return b.type === "open" ? { parts: setPart(b.parts ?? [], f.i, { text: v }) } : {};
    case "partAnswer":
      return b.type === "open" ? { parts: setPart(b.parts ?? [], f.i, { answer: v }) } : {};
    case "cell":
      return b.type === "table" ? { cells: b.cells.map((row, r) => (r === f.r ? row.map((c, k) => (k === f.c ? v : c)) : row)) } : {};
  }
}

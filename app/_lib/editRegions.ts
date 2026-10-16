// Which parts of a block can be typed in directly on the page, and where they are.
// Used by the canvas (double-click / text tool) and by the inline text box.

import {
  CHOICE_W,
  PAD,
  answerTextTop,
  layoutBlank,
  layoutMcq,
  layoutOpen,
  layoutTable,
  layoutText,
  layoutTrueFalse,
  type AnswerArea,
  type Spec,
} from "./blockLayout";
import { isRtl } from "./i18n";
import type { Block, ExamMeta, OpenPart, ViewMode } from "./types";
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
  spec: Spec;
  answer?: boolean; // a model answer (correction sheet)
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

// The model answer is typed on the dotted lines, only on the correction sheet.
const answerRegion = (field: EditField, a: AnswerArea, spec: Spec): EditRegion => {
  const y = answerTextTop(a, spec.font.size);
  return { field, x: a.x, y, width: a.width, height: Math.max(a.y + a.height - y, a.line), spec: { ...spec, line: a.line }, answer: true, multiline: true };
};

export function editRegions(b: Block, n: number, meta: ExamMeta, mode: ViewMode = "exam"): EditRegion[] {
  const w = b.layout.width;
  const rtl = isRtl(meta.lang);
  const title = (t: { y: number; height: number }, spec: Spec): EditRegion => ({
    field: { kind: "text" },
    x: PAD,
    y: t.y,
    width: w - PAD * 2,
    height: t.height,
    spec,
    multiline: false,
  });

  switch (b.type) {
    case "mcq": {
      const L = layoutMcq(b, n, meta);
      return [
        title(L.title, L.F.title),
        ...L.options.map((o, i) => ({ field: { kind: "option", i } as EditField, x: rtl ? PAD : PAD + 30, y: o.y, width: w - PAD * 2 - 30, height: o.height, spec: L.F.body, multiline: false })),
      ];
    }
    case "truefalse": {
      const L = layoutTrueFalse(b, n, meta);
      return [
        title(L.title, L.F.title),
        ...L.rows.map((r, i) => ({
          field: { kind: "statement", i } as EditField,
          x: rtl ? PAD + CHOICE_W + 10 : PAD,
          y: r.y,
          width: w - PAD * 2 - CHOICE_W - 10,
          height: r.height,
          spec: L.F.body,
          multiline: false,
        })),
      ];
    }
    case "blank": {
      const L = layoutBlank(b, n, meta);
      return [title(L.title, L.F.title), { field: { kind: "content" }, x: PAD, y: L.exam.y, width: w - PAD * 2, height: Math.max(L.exam.height, L.key.height), spec: L.F.body, multiline: true }];
    }
    case "open": {
      const L = layoutOpen(b, n, meta);
      const key = mode === "key";
      const out: EditRegion[] = [title(L.title, L.F.title)];
      if (key && L.main.count > 0) out.push(answerRegion({ kind: "answer" }, L.main, L.F.answer));
      L.parts.forEach((p, i) => {
        out.push({ field: { kind: "part", i }, x: p.area.x, y: p.text.y, width: p.area.width, height: p.text.height, spec: L.F.body, multiline: false });
        if (key && p.area.count > 0) out.push(answerRegion({ kind: "partAnswer", i }, p.area, L.F.answer));
      });
      return out;
    }
    case "text": {
      const L = layoutText(b, meta);
      return [{ field: { kind: "text" }, x: L.x, y: L.text.y, width: L.width, height: L.text.height, spec: L.spec, multiline: b.style === "body", align: L.align }];
    }
    case "table": {
      const L = layoutTable(b, meta);
      return L.rows.flatMap((row, r) =>
        row.cells.map((_, c) => ({
          field: { kind: "cell", r, c } as EditField,
          x: L.colX[c] + 6,
          y: row.y + 4,
          width: L.colW[c] - 12,
          height: row.height - 8,
          spec: row.bold ? { ...L.F.body, font: { ...L.F.body.font, bold: true } } : L.F.body,
          multiline: false,
          align: row.bold ? ("center" as const) : undefined,
        })),
      );
    }
    default:
      return [];
  }
}

export function clickTargets(b: Block, n: number, meta: ExamMeta): ClickTarget[] {
  const w = b.layout.width;
  const rtl = isRtl(meta.lang);
  if (b.type === "mcq") {
    const L = layoutMcq(b, n, meta);
    return L.options.map((o, i) => ({ x: rtl ? w - PAD - 20 : PAD - 2, y: o.y, width: 22, height: L.F.body.line, patch: { correct: i } }));
  }
  if (b.type === "truefalse") {
    const colX = rtl ? PAD : w - PAD - CHOICE_W;
    const half = CHOICE_W / 2;
    return layoutTrueFalse(b, n, meta).rows.flatMap((r, i) =>
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

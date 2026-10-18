// Which parts of a block can be typed in directly on the page, and where they are.
// Used by the canvas (double-click / text tool) and by the inline text box.

import {
  CHOICE_W,
  PAD,
  answerTextTop,
  layoutBlank,
  layoutClassify,
  layoutMatch,
  layoutMcq,
  layoutOpen,
  layoutOrder,
  layoutTable,
  layoutText,
  layoutTrueFalse,
  type AnswerArea,
  type PlacedBox,
  type Spec,
} from "./blockLayout";
import { headerRegions } from "@/app/_components/canvas/blocks/headerParts";
import { toggleMcq } from "./blocks";
import { chromeTextField } from "./onboarding/headerFooterLibrary";
import { isRtl } from "./i18n";
import type { Block, ExamMeta, HeaderFields, OpenPart, ViewMode } from "./types";
import type { BlockPatch } from "./useExam";

export type EditField =
  | { kind: "text" } // question text, or the text of a text block
  | { kind: "option"; i: number }
  | { kind: "statement"; i: number }
  | { kind: "fix"; i: number } // corrected statement (true / false, correction sheet)
  | { kind: "content" } // fill-in-the-blank sentence
  | { kind: "context" } // statement under an open question
  | { kind: "answer" } // model answer of an open question
  | { kind: "part"; i: number } // sub-question text
  | { kind: "partAnswer"; i: number }
  | { kind: "left"; i: number } // matching: left item of pair i
  | { kind: "right"; i: number } // matching: right item of pair i
  | { kind: "item"; i: number } // ordering: item i (in the right order)
  | { kind: "group"; i: number } // classification: name of category i
  | { kind: "cell"; r: number; c: number }
  | { kind: "header"; keys: string[]; sep: string }; // exam header: one or more of its fields, joined by `sep`

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

const boxRegion = (field: EditField, p: PlacedBox, spec: Spec, align?: EditRegion["align"]): EditRegion => ({
  field,
  x: p.x,
  y: p.y,
  width: p.width,
  height: p.height,
  spec,
  multiline: false,
  align,
});

export function editRegions(b: Block, n: number, meta: ExamMeta, mode: ViewMode = "exam"): EditRegion[] {
  const w = b.layout.width;
  const rtl = isRtl(meta.lang);
  const key = mode === "key";
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
      return [title(L.title, L.F.title), ...L.options.map((o, i) => boxRegion({ kind: "option", i }, o, L.F.body))];
    }
    case "truefalse": {
      const L = layoutTrueFalse(b, n, meta);
      const out: EditRegion[] = [title(L.title, L.F.title)];
      L.rows.forEach((r, i) => {
        out.push({
          field: { kind: "statement", i },
          x: rtl ? PAD + CHOICE_W + 10 : PAD,
          y: r.y,
          width: w - PAD * 2 - CHOICE_W - 10,
          height: r.height,
          spec: L.F.body,
          multiline: false,
        });
        // The correction of a false statement is typed on its line, on the correction sheet.
        if (key && r.fix && !b.statements[i]?.answer) out.push(answerRegion({ kind: "fix", i }, r.fix, L.F.answer));
      });
      return out;
    }
    case "blank": {
      const L = layoutBlank(b, n, meta);
      return [title(L.title, L.F.title), { field: { kind: "content" }, x: PAD, y: L.exam.y, width: w - PAD * 2, height: Math.max(L.exam.height, L.key.height), spec: L.F.body, multiline: true }];
    }
    case "open": {
      const L = layoutOpen(b, n, meta);
      const out: EditRegion[] = [title(L.title, L.F.title)];
      if (L.context) out.push({ field: { kind: "context" }, x: PAD, y: L.context.y, width: w - PAD * 2, height: L.context.height, spec: L.F.body, multiline: true });
      if (key && L.main.count > 0) out.push(answerRegion({ kind: "answer" }, L.main, L.F.answer));
      L.parts.forEach((p, i) => {
        out.push({ field: { kind: "part", i }, x: p.area.x, y: p.text.y, width: p.area.width, height: p.text.height, spec: L.F.body, multiline: false });
        if (key && p.area.count > 0) out.push(answerRegion({ kind: "partAnswer", i }, p.area, L.F.answer));
      });
      return out;
    }
    case "match": {
      // Left items are printed in their own order; the right one on row k is pair `r.pair`.
      const L = layoutMatch(b, n, meta);
      return [
        title(L.title, L.F.title),
        ...L.rows.flatMap((r, k) => [boxRegion({ kind: "left", i: k }, r.left, L.F.body), boxRegion({ kind: "right", i: r.pair }, r.right, L.F.body)]),
      ];
    }
    case "order": {
      const L = layoutOrder(b, n, meta);
      return [title(L.title, L.F.title), ...L.rows.map((r) => boxRegion({ kind: "item", i: r.item }, r.text, L.F.body))];
    }
    case "classify": {
      const L = layoutClassify(b, n, meta);
      const bold = { ...L.F.body, font: { ...L.F.body.font, bold: true } };
      return [title(L.title, L.F.title), ...L.heads.map((h, i) => boxRegion({ kind: "group", i }, h, bold, "center"))];
    }
    case "header":
      return headerRegions(b, meta, mode);
    case "text": {
      // A header/footer text filled in automatically (page numbers, a rule) has nothing to type.
      if (b.meta?.role && !chromeTextField(b)) return [];
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
    return L.options.map((o, i) => ({ x: o.markX - 11, y: o.y, width: 22, height: L.F.body.line, patch: toggleMcq(b, i) }));
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
    case "fix":
      return b.type === "truefalse" ? (b.statements[f.i]?.fix ?? "") : "";
    case "content":
      return b.type === "blank" ? b.content : "";
    case "context":
      return b.type === "open" ? (b.context ?? "") : "";
    case "answer":
      return b.type === "open" ? b.answer : "";
    case "part":
      return b.type === "open" ? (b.parts?.[f.i]?.text ?? "") : "";
    case "partAnswer":
      return b.type === "open" ? (b.parts?.[f.i]?.answer ?? "") : "";
    case "left":
      return b.type === "match" ? (b.pairs[f.i]?.left ?? "") : "";
    case "right":
      return b.type === "match" ? (b.pairs[f.i]?.right ?? "") : "";
    case "item":
      return b.type === "order" ? (b.items[f.i] ?? "") : "";
    case "group":
      return b.type === "classify" ? (b.groups[f.i]?.name ?? "") : "";
    case "cell":
      return b.type === "table" ? (b.cells[f.r]?.[f.c] ?? "") : "";
    case "header":
      return b.type === "header" ? f.keys.map((k) => String(b.fields[k as keyof HeaderFields] ?? "")).join(f.sep) : "";
  }
}

// Typed text of a header text back into its fields: split on the separator, the rest in the last one.
function headerFields(f: { keys: string[]; sep: string }, v: string): Record<string, string> {
  if (f.keys.length < 2) return { [f.keys[0]]: v };
  const parts = v.split(f.sep.trim()).map((s) => s.trim());
  return Object.fromEntries(f.keys.map((k, i) => [k, i < f.keys.length - 1 ? (parts[i] ?? "") : parts.slice(i).join(` ${f.sep.trim()} `)]));
}

const setPart = (parts: OpenPart[], i: number, patch: Partial<OpenPart>) => parts.map((p, k) => (k === i ? { ...p, ...patch } : p));
const setAt = <T,>(list: T[], i: number, fn: (x: T) => T) => list.map((x, k) => (k === i ? fn(x) : x));

export function fieldPatch(b: Block, f: EditField, v: string): BlockPatch {
  switch (f.kind) {
    case "text":
      return { text: v } as BlockPatch;
    case "option":
      return b.type === "mcq" ? { options: b.options.map((o, k) => (k === f.i ? v : o)) } : {};
    case "statement":
      return b.type === "truefalse" ? { statements: setAt(b.statements, f.i, (s) => ({ ...s, text: v })) } : {};
    case "fix":
      return b.type === "truefalse" ? { statements: setAt(b.statements, f.i, (s) => ({ ...s, fix: v })) } : {};
    case "content":
      return { content: v };
    case "context":
      return { context: v };
    case "answer":
      return { answer: v };
    case "part":
      return b.type === "open" ? { parts: setPart(b.parts ?? [], f.i, { text: v }) } : {};
    case "partAnswer":
      return b.type === "open" ? { parts: setPart(b.parts ?? [], f.i, { answer: v }) } : {};
    case "left":
      return b.type === "match" ? { pairs: setAt(b.pairs, f.i, (p) => ({ ...p, left: v })) } : {};
    case "right":
      return b.type === "match" ? { pairs: setAt(b.pairs, f.i, (p) => ({ ...p, right: v })) } : {};
    case "item":
      return b.type === "order" ? { items: setAt(b.items, f.i, () => v) } : {};
    case "group":
      return b.type === "classify" ? { groups: setAt(b.groups, f.i, (g) => ({ ...g, name: v })) } : {};
    case "cell":
      return b.type === "table" ? { cells: b.cells.map((row, r) => (r === f.r ? row.map((c, k) => (k === f.c ? v : c)) : row)) } : {};
    case "header":
      return b.type === "header" ? { fields: { ...b.fields, ...headerFields(f, v) } } : {};
  }
}

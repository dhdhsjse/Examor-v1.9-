import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
  type ParagraphChild,
} from "docx";
import { blankAnswers, blankExam, blankKey, blockFonts, DEFAULT_ACCENT, partLabel, tableColumnWidths, textSpec, type Fonts } from "./blockLayout";
import { isQuestion, questionNumbers } from "./blocks";
import { optionLabel, words } from "./i18n";
import { drawInlineMath, EX_EM, inlineMathUrl, type InlineMath } from "./inlineMath";
import { PAGE_MARGIN } from "./a4";
import { getPageMm } from "./pageFormats";
import { parseRich, plainText, type Run } from "./richText";
import { fixOrder, shuffled } from "./shuffle";
import { displayGrid } from "./table/display";
import { cellLook, isCovered, isFixedTable, mergeAt, tableMirrored } from "./table/model";
import { docParagraphs, textboxDoc } from "./textboxDoc";
import type { Block, ExamDoc, HeaderBlock, QuestionBlock, TableBlock, ViewMode } from "./types";

// The exam as a Word document that can be edited: its questions, texts, header and tables as Word text and tables, in the order they
// are read on the pages (a page break between pages); what is drawn (pictures, shapes, graphs, formulas, a table with drawings on it)
// as a picture of it cut from the page. An Arabic exam is written right to left. The look is close to the paper, not the same: Word
// places things its own way. The correction ("key") has the answers written in, in the answers' colour.

/** A drawn block as a PNG, the size it has on the page (px) */
export interface Picture {
  data: Uint8Array;
  width: number;
  height: number;
}

/** One copy of the exam: the exam (or a version of it), or its correction. */
export interface WordCopy {
  doc: ExamDoc;
  mode: ViewMode;
  pictures: Map<string, Picture>; // by block id
}

/** The blocks that go into Word as pictures */
export const isPictureBlock = (b: Block) =>
  b.type === "image" || b.type === "shape" || b.type === "graph" || b.type === "equation" || b.type === "divider" || (b.type === "table" && isFixedTable(b));

// ---- units and colours ----
const TW = 15; // twips in a page pixel (96 per inch)
const half = (px: number) => Math.round(px * 1.5); // px → half-points
let probe: CanvasRenderingContext2D | null = null;
function hex(c: string | undefined): string | undefined {
  if (!c || c === "transparent" || c === "none") return undefined;
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) return undefined;
  probe.fillStyle = "#000";
  probe.fillStyle = c;
  const v = String(probe.fillStyle);
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.slice(1).toUpperCase();
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
  if (!m || (m[4] !== undefined && +m[4] === 0)) return undefined;
  return [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const family = (css: string | undefined) => (css ? css.split(",")[0].trim().replace(/^["']|["']$/g, "") : undefined);

// ---- formulas in the text: drawn as small pictures ----
async function mathPicture(m: InlineMath, size: number): Promise<Picture | null> {
  const url = inlineMathUrl(m) ?? (await drawInlineMath(m.latex).then((d) => d.url, () => ""));
  if (!url) return null;
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);
  const width = Math.max(1, m.w * EX_EM * size);
  const height = Math.max(1, m.h * EX_EM * size);
  const k = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * k);
  canvas.height = Math.ceil(height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: dataUrlBytes(canvas.toDataURL("image/png")), width, height };
}

export function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- writing one copy ----
interface Base {
  font?: string;
  size: number; // px
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

class Writer {
  readonly out: (Paragraph | Table)[] = [];
  private maths = new Map<string, Picture | null>();
  readonly rtl: boolean;
  readonly key: boolean;
  readonly keyColor: string;
  readonly width: number; // the room for the text, px

  constructor(
    readonly doc: ExamDoc,
    mode: ViewMode,
    readonly pictures: Map<string, Picture>,
    width: number,
  ) {
    this.rtl = doc.meta.lang === "ar";
    this.key = mode === "key";
    this.keyColor = doc.meta.answerColor ?? "#15803d";
    this.width = width;
  }

  // the formulas of the copy, drawn once before writing
  async prepare(texts: string[], size: number) {
    for (const t of texts)
      for (const r of parseRich(t))
        if (r.style.math && !this.maths.has(r.style.math.latex)) this.maths.set(r.style.math.latex, await mathPicture(r.style.math, size));
  }

  runs(text: string | Run[], base: Base): ParagraphChild[] {
    const list = typeof text === "string" ? parseRich(text) : text;
    const out: ParagraphChild[] = [];
    for (const r of list) {
      if (r.style.math) {
        const pic = this.maths.get(r.style.math.latex);
        if (pic) out.push(new ImageRun({ type: "png", data: pic.data, transformation: { width: pic.width, height: pic.height } }));
        else out.push(new TextRun({ text: r.style.math.latex, rightToLeft: this.rtl }));
        continue;
      }
      const s = r.style;
      const size = s.size ?? base.size;
      const font = family(s.font) ?? base.font;
      out.push(
        new TextRun({
          text: r.text,
          bold: s.b ?? base.bold,
          boldComplexScript: s.b ?? base.bold,
          italics: s.i ?? base.italic,
          italicsComplexScript: s.i ?? base.italic,
          underline: s.u ? {} : undefined,
          strike: s.x,
          color: hex(s.color ?? base.color),
          size: half(size),
          sizeComplexScript: half(size),
          font: font ? { ascii: font, hAnsi: font, cs: font, eastAsia: font } : undefined,
          subScript: s.sub,
          superScript: s.sup,
          shading: s.hl && hex(s.hl) ? { type: ShadingType.CLEAR, fill: hex(s.hl)!, color: "auto" } : undefined,
          rightToLeft: this.rtl,
        }),
      );
    }
    return out;
  }

  para(
    children: ParagraphChild[],
    opts: {
      align?: "left" | "center" | "right" | "start" | "end" | "justify";
      before?: number;
      after?: number;
      indent?: number;
      border?: "dotted" | "single";
      keepNext?: boolean;
      fill?: string;
      lines?: { sides: ("top" | "bottom" | "start" | "end")[]; color: string; size: number };
    } = {},
  ) {
    const physical = (a: string | undefined) =>
      a === "center" ? AlignmentType.CENTER : a === "justify" ? AlignmentType.JUSTIFIED : a === "left" ? AlignmentType.LEFT : a === "right" ? AlignmentType.RIGHT : a === "end" ? (this.rtl ? AlignmentType.LEFT : AlignmentType.RIGHT) : undefined;
    return new Paragraph({
      children,
      bidirectional: this.rtl,
      alignment: physical(opts.align),
      spacing: { before: (opts.before ?? 0) * TW, after: (opts.after ?? 4) * TW },
      indent: opts.indent ? (this.rtl ? { right: opts.indent * TW } : { left: opts.indent * TW }) : undefined,
      keepNext: opts.keepNext,
      shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
      border: opts.lines
        ? Object.fromEntries(
            opts.lines.sides.map((side) => [
              side === "start" ? (this.rtl ? "right" : "left") : side === "end" ? (this.rtl ? "left" : "right") : side,
              { style: BorderStyle.SINGLE, size: opts.lines!.size, color: opts.lines!.color, space: side === "top" || side === "bottom" ? 2 : 6 },
            ]),
          )
        : opts.border
          ? { bottom: { style: opts.border === "dotted" ? BorderStyle.DOTTED : BorderStyle.SINGLE, size: 6, color: "9CA3AF", space: 1 } }
          : undefined,
    });
  }

  private text(text: string, base: Base, opts?: Parameters<Writer["para"]>[1]) {
    this.out.push(this.para(this.runs(text, base), opts));
  }

  private grid(rows: { children: Paragraph[]; fill?: string; span?: number; rowSpan?: number; width?: number; valign?: "top" | "middle" | "bottom" }[][], opts: { borders: boolean; widths?: number[]; rtl?: boolean }) {
    const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const line: IBorderOptions = { style: BorderStyle.SINGLE, size: 6, color: "374151" };
    const b = opts.borders ? line : none;
    return new Table({
      width: { size: this.width * TW, type: WidthType.DXA },
      columnWidths: opts.widths?.map((w) => Math.round(w * TW)),
      layout: TableLayoutType.FIXED,
      visuallyRightToLeft: opts.rtl ?? this.rtl,
      borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
      rows: rows.map(
        (cells) =>
          new TableRow({
            children: cells.map(
              (c) =>
                new TableCell({
                  children: c.children.length ? c.children : [new Paragraph({})],
                  columnSpan: c.span,
                  rowSpan: c.rowSpan,
                  width: c.width ? { size: c.width * TW, type: WidthType.DXA } : undefined,
                  shading: c.fill ? { type: ShadingType.CLEAR, fill: c.fill, color: "auto" } : undefined,
                  verticalAlign: c.valign === "middle" ? VerticalAlign.CENTER : c.valign === "bottom" ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
                  margins: { top: 40, bottom: 40, left: 80, right: 80 },
                }),
            ),
          }),
      ),
    });
  }

  // lines to write on: dotted, plain, or an empty frame; the model answer written on them in the key
  private answerLines(count: number, style: string | undefined, answer: string, F: Fonts, indent = 0) {
    const n = Math.max(0, count);
    const shown = this.key && plainText(answer).trim() ? answer : "";
    if (!n && !shown) return;
    if (style === "grid" || style === "box") {
      const height = Math.max(1, n) * 28;
      const box = [this.para(shown ? this.runs(shown, { ...this.answerBase(F) }) : [], { after: 0 })];
      this.out.push(
        new Table({
          width: { size: (this.width - indent) * TW, type: WidthType.DXA },
          visuallyRightToLeft: this.rtl,
          rows: [new TableRow({ height: { value: height * TW, rule: "atLeast" }, children: [new TableCell({ children: box })] })],
        }),
      );
      return;
    }
    const lines = Math.max(n, shown ? 1 : 0);
    for (let k = 0; k < lines; k++)
      this.out.push(this.para(k === 0 && shown ? this.runs(shown, this.answerBase(F)) : [new TextRun({ text: " ", size: half(F.body.font.size) })], { before: 8, after: 0, indent, border: style === "none" ? undefined : style === "lines" ? "single" : "dotted" }));
  }

  private answerBase = (F: Fonts): Base => ({ font: family(F.answer.font.family), size: F.answer.font.size, color: this.keyColor });
  private bodyBase = (F: Fonts): Base => ({ font: family(F.body.font.family), size: F.body.font.size, bold: F.body.font.bold, italic: F.body.font.italic, color: F.body.font.color });
  private titleBase = (F: Fonts): Base => ({ font: family(F.title.font.family), size: F.title.font.size, bold: F.title.font.bold, italic: F.title.font.italic, color: F.title.font.color });

  // "3. The question (2 pts)"
  private title(b: QuestionBlock, n: number, F: Fonts) {
    const pts = b.points > 0 && !F.hidePoints ? ` ${words(F.lang).pts(b.points)}` : "";
    this.out.push(this.para([...this.runs(`${n}. `, this.titleBase(F)), ...this.runs(b.text, this.titleBase(F)), ...this.runs(pts, this.titleBase(F))], { before: 10, after: 4, keepNext: true }));
  }

  private bank(items: string[], seed: string, F: Fonts) {
    const clean = items.map((w) => plainText(w).trim()).filter(Boolean);
    if (!clean.length) return;
    this.out.push(this.grid([[{ children: [this.para(this.runs(shuffled(clean, seed).join("  /  "), this.bodyBase(F)), { align: "center", after: 0 })] }]], { borders: true }));
    this.out.push(this.para([], { after: 2 }));
  }

  question(b: QuestionBlock, n: number) {
    const F = blockFonts(b, this.doc.meta);
    const body = this.bodyBase(F);
    const ans = this.answerBase(F);
    const w = words(F.lang);
    this.title(b, n, F);
    switch (b.type) {
      case "mcq": {
        const cols = Math.max(1, Math.min(4, Math.round(b.columns ?? 1)));
        const right = new Set(b.multi ? (b.corrects ?? []) : [b.correct]);
        const cells = b.options.map((o, i) => {
          const hit = this.key && right.has(i);
          const mark = b.multi ? (hit ? "☑" : "☐") : hit ? "●" : "○";
          const base = hit ? { ...body, color: this.keyColor, bold: true } : body;
          return { children: [this.para([...this.runs(`${mark}  ${optionLabel(i, F.lang)})  `, base), ...this.runs(o, base)], { after: 0 })] };
        });
        const rows: (typeof cells)[] = [];
        for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
        const last = rows[rows.length - 1];
        while (last && last.length < cols) last.push({ children: [] });
        if (rows.length) this.out.push(this.grid(rows, { borders: false, widths: Array(cols).fill(this.width / cols) }));
        break;
      }
      case "truefalse": {
        const wide = this.width - 160;
        for (const [i, s] of b.statements.entries()) {
          const box = (yes: boolean) => {
            const hit = this.key && s.answer === yes;
            return { children: [this.para(this.runs(`${hit ? "☑" : "☐"} ${yes ? w.true : w.false}`, hit ? { ...body, color: this.keyColor, bold: true } : body), { after: 0 })], width: 80 };
          };
          this.out.push(this.grid([[{ children: [this.para(this.runs(`${i + 1}) ${s.text}`, body), { after: 0 })], width: wide }, box(true), box(false)]], { borders: false, widths: [wide, 80, 80] }));
          if (b.justify) this.answerLines(1, "dotted", s.answer ? "" : (s.fix ?? ""), F, 18);
        }
        break;
      }
      case "blank":
        if (b.wordBank) this.bank([...blankAnswers(b.content), ...(b.distractors ?? [])], b.id, F);
        this.text(this.key ? blankKey(b.content, this.keyColor) : blankExam(b.content), body, { after: 4 });
        break;
      case "open":
        if (b.context && plainText(b.context).trim()) this.text(b.context, body);
        this.answerLines(b.lines, b.answerStyle, b.answer, F);
        for (const [i, p] of (b.parts ?? []).entries()) {
          const label = partLabel(b, n, i, F.lang);
          const pts = p.points > 0 && !F.hidePoints ? ` ${w.pts(p.points)}` : "";
          this.out.push(this.para(this.runs(`${label ? `${label} ` : ""}${p.text}${pts}`, body), { before: 6, indent: 18, keepNext: true }));
          this.answerLines(p.lines, b.answerStyle, p.answer, F, 18);
        }
        break;
      case "match": {
        const order = fixOrder(b.order, b.pairs.length);
        const col = (this.width - 100) / 2;
        const rows = b.pairs.map((p, r) => {
          const to = order.indexOf(r); // (the row where this pair's right item is printed)
          const link = this.key ? `  → ${String.fromCharCode(97 + to)}` : "";
          return [
            { children: [this.para([...this.runs(`${r + 1}. ${p.left}  •`, body), ...this.runs(link, { ...ans, bold: true })], { after: 0, align: "end" })], width: col },
            { children: [], width: 100 },
            { children: [this.para(this.runs(`•  ${String.fromCharCode(97 + r)}. ${b.pairs[order[r]]?.right ?? ""}`, body), { after: 0 })], width: col },
          ];
        });
        this.out.push(this.grid(rows, { borders: false, widths: [col, 100, col] }));
        break;
      }
      case "order": {
        const order = fixOrder(b.order, b.items.length);
        if (b.style === "sentence") {
          this.text(order.map((i) => b.items[i]).join("  /  "), body);
          this.answerLines(1, "dotted", b.items.join(" "), F);
        } else
          for (const i of order) {
            const rank = this.key ? `[${i + 1}]` : "[   ]";
            this.out.push(this.para([...this.runs(`${rank}  `, this.key ? { ...ans, bold: true } : body), ...this.runs(b.items[i] ?? "", body)], { after: 2 }));
          }
        break;
      }
      case "classify": {
        if (!b.hideBank) this.bank(b.groups.flatMap((g) => g.items), b.id, F);
        const cols = Math.max(1, b.groups.length);
        const rowCount = Math.max(1, ...b.groups.map((g) => g.items.length));
        const head = b.groups.map((g) => ({ children: [this.para(this.runs(g.name, { ...body, bold: true }), { align: "center", after: 0 })], fill: "F3F4F6" }));
        const rows = Array.from({ length: rowCount }, (_, r) => b.groups.map((g) => ({ children: [this.para(this.key && g.items[r] ? this.runs(g.items[r], ans) : [], { after: 0 })] })));
        this.out.push(this.grid([head, ...rows], { borders: true, widths: Array(cols).fill(this.width / cols) }));
        break;
      }
    }
  }

  header(b: HeaderBlock) {
    const F = blockFonts(b, this.doc.meta);
    const body = this.bodyBase(F);
    const f = b.fields;
    const w = words(F.lang);
    const lines = (list: (string | undefined)[], align: "start" | "end") => list.filter((t) => t && plainText(t).trim()).map((t) => this.para(this.runs(t!, { ...body, size: body.size - 2 }), { align, after: 0 }));
    const half2 = this.width / 2;
    this.out.push(
      this.grid(
        [
          [
            { children: lines([f.republic, f.authority, f.directorate, f.school, f.year ? `${w.year} : ${f.year}` : ""], "start"), width: half2 },
            { children: lines([f.subject ? `${w.subject} : ${f.subject}` : "", f.level ? `${w.level} : ${f.level}` : "", f.duration ? `${w.duration} : ${f.duration}` : ""], "end"), width: half2 },
          ],
        ],
        { borders: false, widths: [half2, half2] },
      ),
    );
    const title = this.key ? `${f.title} — ${w.key}` : f.title;
    this.out.push(this.para(this.runs(title, { ...body, size: body.size + 6, bold: true }), { align: "center", before: 8, after: 8 }));
    const outOf = f.autoOutOf ? this.doc.blocks.filter(isQuestion).reduce((s, q) => s + q.points, 0) || f.outOf : f.outOf;
    const wide = this.width - 140;
    this.out.push(
      this.grid(
        [
          [
            { children: [this.para(this.runs(`${w.name} : ........................................................`, body), { after: 2 }), this.para(this.runs(`${w.class} : ............     ${w.number} : ............`, body), { after: 0 })], width: wide },
            { children: [this.para(this.runs(w.score, { ...body, bold: true, size: body.size - 2 }), { align: "center", after: 0 }), this.para(this.runs(`...... / ${outOf}`, { ...body, bold: true }), { align: "center", after: 0 })], width: 140, valign: "middle" },
          ],
        ],
        { borders: false, widths: [wide, 140] },
      ),
    );
    this.out.push(this.para([], { after: 4 }));
  }

  table(b: TableBlock) {
    const F = blockFonts(b, this.doc.meta);
    const body = this.bodyBase(F);
    const grid = displayGrid(b, this.doc.meta.lang);
    const widths = tableColumnWidths(b);
    const k = Math.min(1, this.width / Math.max(1, widths.reduce((s, x) => s + x, 0)));
    const cols = widths.map((x) => x * k);
    const mirrored = tableMirrored(b, this.rtl);
    const rows = grid.map((row, r) =>
      row.flatMap((text, c) => {
        if (isCovered(b, r, c)) return [];
        const m = mergeAt(b, r, c);
        const look = cellLook(b, r, c);
        const base: Base = { ...body, font: family(look.family) ?? body.font, bold: look.bold ?? body.bold, italic: look.italic ?? body.italic, size: look.size ?? body.size, color: look.color ?? body.color };
        const align = look.align === "center" ? "center" : look.align === "right" ? "right" : look.align === "left" ? "left" : undefined;
        return [
          {
            children: [this.para(this.runs(text, base), { align, after: 0 })],
            span: m && m.cs > 1 ? m.cs : undefined,
            rowSpan: m && m.rs > 1 ? m.rs : undefined,
            width: cols.slice(c, c + (m?.cs ?? 1)).reduce((s, x) => s + x, 0),
            fill: hex(look.fill),
            valign: look.valign,
          },
        ];
      }),
    );
    // (the first column on the right when the table reads right to left: Arabic, unless it is flipped)
    this.out.push(this.grid(rows, { borders: b.borders !== "none", widths: cols, rtl: mirrored }), this.para([], { after: 4 }));
  }

  textBlock(b: Block & { type: "text" }) {
    const spec = textSpec(b, this.doc.meta);
    const base: Base = { font: family(spec.font.family), size: spec.font.size, bold: spec.font.bold, italic: spec.font.italic, color: spec.font.color };
    const align = b.align ?? (b.style === "title" ? "center" : undefined);
    const gap = b.style === "body" ? 2 : 6;
    // its decoration: a band or a pill of colour (the text on it as drawn), a line under it or at its start, a frame
    const accent = hex(b.accent ?? DEFAULT_ACCENT) ?? "4F46E5";
    const decor = b.decor ?? "plain";
    const look: Parameters<Writer["para"]>[1] =
      decor === "band" || decor === "pill"
        ? { fill: accent }
        : decor === "underline" || decor === "rule"
          ? { lines: { sides: ["bottom"], color: accent, size: decor === "rule" ? 8 : 18 } }
          : decor === "bar"
            ? { lines: { sides: ["start"], color: accent, size: 36 } }
            : decor === "boxed"
              ? { lines: { sides: ["top", "bottom", "start", "end"], color: accent, size: 8 } }
              : {};
    for (const line of b.text.split("\n")) this.out.push(this.para(this.runs(line, base), { align, before: gap, after: gap, keepNext: b.style !== "body", ...look }));
  }

  textbox(b: Block & { type: "textbox" }) {
    const size = this.doc.meta.fontSize ?? 14;
    const paras = docParagraphs(textboxDoc(b)).map((p) =>
      this.para(this.runs(p.runs, { size }), { align: p.align ?? b.align, before: p.spaceBefore, after: p.spaceAfter, indent: p.indent * 24 }),
    );
    if (b.border || b.background) {
      const line = hex(b.border);
      const bd: IBorderOptions = line ? { style: BorderStyle.SINGLE, size: Math.max(2, Math.round((b.borderWidth ?? 1) * 6)), color: line } : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const width = Math.min(this.width, b.layout.width);
      this.out.push(
        new Table({
          width: { size: width * TW, type: WidthType.DXA },
          visuallyRightToLeft: this.rtl,
          borders: { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd },
          rows: [new TableRow({ children: [new TableCell({ children: paras.length ? paras : [new Paragraph({})], shading: hex(b.background) ? { type: ShadingType.CLEAR, fill: hex(b.background)!, color: "auto" } : undefined, margins: { top: 80, bottom: 80, left: 120, right: 120 } })] })],
        }),
        this.para([], { after: 4 }),
      );
    } else this.out.push(...paras);
  }

  picture(b: Block) {
    const pic = this.pictures.get(b.id);
    if (!pic) return;
    const k = Math.min(1, this.width / pic.width);
    // (where it sits across the page: at the start, in the middle, or at the end)
    const mid = b.layout.x + pic.width / 2;
    const page = this.width + PAGE_MARGIN * 2;
    const align = Math.abs(mid - page / 2) < page * 0.12 ? "center" : (mid < page / 2) !== this.rtl ? "start" : "end";
    this.out.push(this.para([new ImageRun({ type: "png", data: pic.data, transformation: { width: pic.width * k, height: pic.height * k } })], { align: align === "start" ? (this.rtl ? "right" : "left") : align, before: 4, after: 4 }));
  }
}

// The blocks of a copy in reading order: page by page, top to bottom, then from the start side.
export function readingOrder(doc: ExamDoc): Block[][] {
  const rtl = doc.meta.lang === "ar";
  return doc.pages.map((p) =>
    doc.blocks
      .filter((b) => b.layout.pageId === p.id && b.type !== "mark" && b.type !== "rule")
      .sort((a, b) => a.layout.y - b.layout.y || (rtl ? b.layout.x - a.layout.x : a.layout.x - b.layout.x)),
  );
}

async function section(copy: WordCopy): Promise<ISectionOptions> {
  const { doc } = copy;
  const first = doc.pages[0];
  const mm = getPageMm(first?.format);
  const margins = first?.margins ?? { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN };
  const pageW = mm.width * (96 / 25.4);
  const w = new Writer(doc, copy.mode, copy.pictures, pageW - margins.left - margins.right);
  // every text that may hold a formula, drawn first
  const texts: string[] = [];
  const grab = (v: unknown) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(grab);
    else if (v && typeof v === "object") Object.values(v).forEach(grab);
  };
  doc.blocks.filter((b) => !isPictureBlock(b) && b.type !== "textbox").forEach(grab);
  await w.prepare(texts, doc.meta.fontSize ?? 14);
  const numbers = questionNumbers(doc.blocks, doc.pages);
  readingOrder(doc).forEach((blocks, i) => {
    if (i > 0) w.out.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 }, children: [] }));
    for (const b of blocks) {
      if (isPictureBlock(b)) w.picture(b);
      else if (isQuestion(b)) w.question(b, numbers.get(b.id) ?? 1);
      else if (b.type === "header") w.header(b);
      else if (b.type === "table") w.table(b);
      else if (b.type === "text") w.textBlock(b);
      else if (b.type === "textbox") w.textbox(b);
    }
  });
  const tw = (px: number) => Math.round(px * TW);
  return {
    properties: {
      page: {
        size: { width: Math.round(mm.width * 56.6929), height: Math.round(mm.height * 56.6929), orientation: mm.width > mm.height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: { top: tw(margins.top), right: tw(margins.right), bottom: tw(margins.bottom), left: tw(margins.left) },
      },
    },
    children: w.out,
  };
}

/** The copies as one Word file (.docx), each one from a new page. */
export async function examToDocx(copies: WordCopy[]): Promise<Uint8Array> {
  const sections: ISectionOptions[] = [];
  for (const c of copies) sections.push(await section(c));
  const doc = copies[0]?.doc;
  const font = family(doc?.meta.fontFamily) ?? "Segoe UI";
  const file = new Document({
    creator: "Examor",
    title: doc?.meta.title ?? "",
    styles: { default: { document: { run: { font: { ascii: font, hAnsi: font, cs: font, eastAsia: font }, size: half(doc?.meta.fontSize ?? 14) } } } },
    sections,
  });
  return new Uint8Array(await Packer.toArrayBuffer(file));
}

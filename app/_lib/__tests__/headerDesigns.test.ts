import { describe, expect, it } from "vitest";
import { headerHeight } from "../blockLayout";
import { DESIGN_CATEGORIES, HEADER_DESIGNS, drawDesign, type HOp } from "../headerDesigns";
import { words } from "../i18n";
import { headerTemplates } from "../onboarding/headerFooterLibrary";
import { BORDER_STYLES, DEFAULT_BORDER, borderBox, borderReach } from "../pageBorder";
import { buildChrome } from "../pageChrome";
import { AR, FR } from "../uiStrings";
import type { ExamDoc, HeaderBlock, Lang, PageBorder } from "../types";

const t = ((s: string) => s) as never;

const doc = (lang: Lang, border?: PageBorder, format?: ExamDoc["pages"][number]["format"]): ExamDoc => ({
  version: 1,
  meta: { title: "Exam", lang, templateId: "" },
  pages: [{ id: "p1", ...(border ? { border } : {}), ...(format ? { format } : {}) }],
  blocks: [],
});

const BORDERS: (PageBorder | undefined)[] = [
  undefined,
  { ...DEFAULT_BORDER, style: "single", width: 1 },
  { ...DEFAULT_BORDER, style: "double", width: 2 },
  { ...DEFAULT_BORDER, style: "thick-thin", width: 6, inset: 40 },
  { ...DEFAULT_BORDER, style: "rounded", width: 3 },
  { ...DEFAULT_BORDER, style: "dashed", width: 2, inset: 10 },
  { ...DEFAULT_BORDER, style: "certificate", width: 2 },
  { ...DEFAULT_BORDER, style: "islamic", width: 2, inset: 60 },
];

const headerOf = (d: ExamDoc, id: string) => buildChrome(d, 0, "header", t, { enabled: true, templateId: `header.${id}`, data: {} }).find((b): b is HeaderBlock => b.type === "header")!;

function opsOf(b: HeaderBlock, lang: Lang) {
  const inset = b.inset!;
  const W = b.layout.width - inset.left - inset.right;
  const y0 = Math.min(0, (b.frame?.top ?? 0) - b.layout.y);
  const f = b.fields;
  return { W, y0, ops: drawDesign(b.style, { W, rtl: lang === "ar", t: words(lang), f, title: f.title, outOf: f.outOf, x0: -inset.left, x1: W + inset.right, y0, family: "Arial" }) };
}

const bottomOf = (op: HOp) => (op.k === "text" ? op.y + op.size * 1.2 : op.k === "rect" ? op.y + op.h : op.k === "circle" ? op.y + op.r : Math.max(...op.pts.filter((_, i) => i % 2)));

describe("header designs", () => {
  it("has a wide library: 40+ designs, each family well filled, ids unique", () => {
    expect(HEADER_DESIGNS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(HEADER_DESIGNS.map((d) => d.id)).size).toBe(HEADER_DESIGNS.length);
    for (const c of DESIGN_CATEGORIES) expect(HEADER_DESIGNS.filter((d) => d.category === c.id).length, c.id).toBeGreaterThanOrEqual(8);
    // every design is a header template, under its family
    for (const d of HEADER_DESIGNS) expect(headerTemplates.find((h) => h.id === `header.${d.id}`)?.category).toBe(d.category);
  });

  it("fits every page border, in both directions: texts inside the header, nothing past its height", () => {
    for (const lang of ["fr", "ar"] as Lang[]) {
      for (const border of BORDERS) {
        for (const format of [undefined, { size: "A5" as const, orientation: "portrait" as const }]) {
          const d = doc(lang, border, format);
          for (const design of HEADER_DESIGNS) {
            const b = headerOf(d, design.id);
            const where = `${design.id} ${lang} ${border?.style ?? "none"} ${format?.size ?? "A4"}`;
            expect(b.style, where).toBe(design.id);
            const { W, ops } = opsOf(b, lang);
            const H = headerHeight(b.style);
            expect(JSON.stringify(ops), where).not.toMatch(/NaN|Infinity|null/);
            for (const op of ops) {
              expect(bottomOf(op), `${where}: ${JSON.stringify(op)}`).toBeLessThanOrEqual(H + 2);
              if (op.k !== "text") continue;
              expect(op.x, `${where}: ${op.text}`).toBeGreaterThanOrEqual(-0.5);
              expect(op.x + op.w, `${where}: ${op.text}`).toBeLessThanOrEqual(W + 0.5);
              expect(op.y, `${where}: ${op.text}`).toBeGreaterThanOrEqual(-0.5);
            }
          }
        }
      }
    }
  });

  it("puts the header in the room inside the border, its bands starting at the top of that room", () => {
    for (const border of BORDERS.filter(Boolean) as PageBorder[]) {
      const d = doc("fr", border);
      const box = borderBox(border, 794, 1123);
      for (const design of HEADER_DESIGNS) {
        const b = headerOf(d, design.id);
        expect(b.layout.x).toBeCloseTo(box.x0);
        expect(b.layout.x + b.layout.width).toBeCloseTo(box.x1);
        expect(b.frame?.top).toBeCloseTo(box.y0);
        expect(b.layout.y).toBeGreaterThanOrEqual(borderReach(border));
        const { y0, ops } = opsOf(b, "fr");
        // (whatever starts above the header starts at the top of the room, never above it)
        for (const op of ops) if (op.k === "rect" && op.y < 0) expect(op.y, design.id).toBeCloseTo(y0);
      }
    }
  });

  it("mirrors itself right to left", () => {
    for (const design of HEADER_DESIGNS) {
      const fr = opsOf(headerOf(doc("fr"), design.id), "fr");
      const ar = opsOf(headerOf(doc("ar"), design.id), "ar");
      expect(ar.ops.map((o) => o.k), design.id).toEqual(fr.ops.map((o) => o.k));
      // the first text of a design that is at the start in French is at the start (right) in Arabic
      const first = fr.ops.find((o) => o.k === "text" && o.align === "left" && !o.ltr);
      const index = fr.ops.indexOf(first!);
      const mirrored = ar.ops[index];
      if (first && mirrored?.k === "text") expect(mirrored.align, design.id).toBe("right");
    }
  });

  it("follows a color", () => {
    const b = headerOf(doc("fr"), "color-band");
    const { W } = opsOf(b, "fr");
    const red = drawDesign("color-band", { W, rtl: false, t: words("fr"), f: b.fields, title: "x", outOf: 20, x0: -48, x1: W + 48, y0: -48, family: "Arial", color: "#dc2626" });
    expect(JSON.stringify(red)).toContain("#dc2626");
  });

  it("has a French and an Arabic name for every design and family", () => {
    const names = [...HEADER_DESIGNS.map((d) => d.name), ...DESIGN_CATEGORIES.map((c) => c.name), "Earlier styles", "Theme color", "Design's own"];
    expect(names.filter((n) => !FR[n])).toEqual([]);
    expect(names.filter((n) => !AR[n])).toEqual([]);
  });
});

describe("border box", () => {
  it("is inside every design of border, and outside nothing the header needs", () => {
    for (const style of BORDER_STYLES) {
      for (const width of [1, 3, 6]) {
        const border = { ...DEFAULT_BORDER, style, width, inset: 24 };
        const box = borderBox(border, 794, 1123);
        expect(box.x0, style).toBeGreaterThan(24 + width / 2);
        expect(box.x0, style).toBeLessThan(borderReach(border));
        expect(box.x1, style).toBeCloseTo(794 - box.x0);
        expect(box.r, style).toBeGreaterThanOrEqual(0);
      }
    }
    expect(borderBox({ ...DEFAULT_BORDER, style: "rounded" }, 794, 1123).corner).toBe("round");
    expect(borderBox({ ...DEFAULT_BORDER, style: "certificate" }, 794, 1123).corner).toBe("scoop");
    expect(borderBox(undefined, 794, 1123)).toEqual({ x0: 0, y0: 0, x1: 794, y1: 1123, corner: "square", r: 0 });
  });
});

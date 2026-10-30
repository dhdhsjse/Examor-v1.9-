// The formatting of a paragraph (Word's Paragraph group), as a text box keeps it on each of its paragraphs and as
// a text block keeps it for the whole text. Pure data and small helpers; the canvas (blockLayout.ts), the editor
// (textboxEditor.ts) and the ribbon all read it.

import { isListKind, type ListKind } from "./lists";
import type { ParagraphAlign } from "./types";

export type Direction = "ltr" | "rtl";

export interface ParagraphFormat {
  align?: ParagraphAlign; // missing = the box's
  indent: number; // levels, INDENT_PX each, from the start side
  list?: ListKind; // an item of a bulleted or numbered list
  dir?: Direction; // writing direction of this paragraph (missing = the box's, then the exam's)
  lineHeight?: number; // line spacing, times the normal one (missing = the box's)
  spaceBefore: number; // px above the paragraph
  spaceAfter: number; // px below it
  shading?: string; // background color of the paragraph
  border?: string; // the sides that have a line: some of "t", "b", "l", "r" (all four = a box)
  borderColor?: string;
}

export const MAX_SPACE = 96;
export const LINE_STEPS = [1, 1.15, 1.5, 2, 2.5, 3];
export const MIN_LINE = 0.8;
export const MAX_LINE = 5;

export const SIDES = ["t", "b", "l", "r"] as const;
export type Side = (typeof SIDES)[number];

/** A spacing as a whole number of px between 0 and MAX_SPACE (anything else: 0). */
export const clampSpace = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(MAX_SPACE, Math.round(Number(v)))) : 0);

/** A line spacing between MIN_LINE and MAX_LINE, to two decimals; undefined when missing or when it is the normal one. */
export function cleanLineHeight(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(Math.max(MIN_LINE, Math.min(MAX_LINE, n)) * 100) / 100;
}

/** The sides of a border, in the fixed order "tblr" (unknown letters and doubles dropped). */
export const cleanSides = (v: unknown): string => SIDES.filter((s) => typeof v === "string" && v.includes(s)).join("");

export const isDirection = (v: unknown): v is Direction => v === "ltr" || v === "rtl";

const COLOR = /^#[0-9a-f]{3,8}$/i;
export const cleanColor = (v: unknown): string | undefined => (typeof v === "string" && COLOR.test(v) ? v : undefined);

const ALIGNS: ParagraphAlign[] = ["left", "center", "right", "justify"];

/** What the attributes of a paragraph node (or of any record) say, cleaned: anything unknown or invalid is dropped. */
export function paragraphFormat(attrs: Record<string, unknown> | undefined, maxIndent: number): ParagraphFormat {
  const a = attrs ?? {};
  const list = isListKind(a.list) ? a.list : undefined;
  const sides = cleanSides(a.border);
  const align = ALIGNS.includes(a.textAlign as ParagraphAlign) ? (a.textAlign as ParagraphAlign) : undefined;
  return {
    ...(align ? { align } : {}),
    indent: Math.max(0, Math.min(maxIndent, Math.round(Number(a.indent) || 0))),
    ...(list ? { list } : {}),
    ...(isDirection(a.dir) ? { dir: a.dir } : {}),
    ...(cleanLineHeight(a.lineHeight) ? { lineHeight: cleanLineHeight(a.lineHeight) } : {}),
    spaceBefore: clampSpace(a.spaceBefore),
    spaceAfter: clampSpace(a.spaceAfter),
    ...(cleanColor(a.shading) ? { shading: cleanColor(a.shading) } : {}),
    ...(sides ? { border: sides } : {}),
    ...(sides && cleanColor(a.borderColor) ? { borderColor: cleanColor(a.borderColor) } : {}),
  };
}

/** The attributes of a paragraph node for this format (null for what is not set, so the editor's schema keeps its defaults). */
export function paragraphAttrs(f: Partial<ParagraphFormat>): Record<string, unknown> {
  return {
    textAlign: f.align ?? null,
    indent: f.indent ?? 0,
    list: f.list ?? null,
    dir: f.dir ?? null,
    lineHeight: f.lineHeight ?? null,
    spaceBefore: f.spaceBefore || null,
    spaceAfter: f.spaceAfter || null,
    shading: f.shading ?? null,
    border: f.border || null,
    borderColor: f.border ? (f.borderColor ?? null) : null,
  };
}

/** Whether a paragraph has any of the formatting that is not the box's own (Reset formatting has something to do). */
export const isFormattedParagraph = (f: ParagraphFormat) =>
  !!(f.align || f.indent || f.list || f.dir || f.lineHeight || f.spaceBefore || f.spaceAfter || f.shading || f.border);

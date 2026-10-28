// Find and replace over the whole exam: every text of every block (the question, its options, a cell, a text box…). A pure
// module: it reads blocks and gives patches (a style of the first letter of a match goes to its replacement), so it can be
// tested without a browser. The panel (Home → Find and replace) is drawn from it.

import { fieldKey, fieldPatch, fieldValue, type EditField } from "./editRegions";
import { deleteRange, insertRich, parseRich, plainText, replaceMatches, serializeRich, styleAt } from "./richText";
import { docFromParagraphs, docParagraphs, richFromDoc, textboxDoc } from "./textboxDoc";
import type { Block } from "./types";
import type { BlockPatch } from "./useExam";

export interface FindOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

/** The texts of a block that hold words, wherever they are (no page layout needed). A generated text (page numbers, a header) has none. */
export function textFields(b: Block): EditField[] {
  const list = (n: number, make: (i: number) => EditField) => Array.from({ length: n }, (_, i) => make(i));
  switch (b.type) {
    case "mcq":
      return [{ kind: "text" }, ...list(b.options.length, (i) => ({ kind: "option", i }))];
    case "truefalse":
      return [{ kind: "text" }, ...list(b.statements.length, (i) => ({ kind: "statement", i })), ...list(b.statements.length, (i) => ({ kind: "fix", i }))];
    case "blank":
      return [{ kind: "text" }, { kind: "content" }];
    case "open":
      return [{ kind: "text" }, { kind: "context" }, { kind: "answer" }, ...(b.parts ?? []).flatMap((_, i): EditField[] => [{ kind: "part", i }, { kind: "partAnswer", i }])];
    case "match":
      return [{ kind: "text" }, ...b.pairs.flatMap((_, i): EditField[] => [{ kind: "left", i }, { kind: "right", i }])];
    case "order":
      return [{ kind: "text" }, ...list(b.items.length, (i) => ({ kind: "item", i }))];
    case "classify":
      return [{ kind: "text" }, ...list(b.groups.length, (i) => ({ kind: "group", i }))];
    case "text":
      return b.meta?.role ? [] : [{ kind: "text" }];
    case "textbox":
      return [{ kind: "text" }];
    case "table":
      return b.cells.flatMap((row, r) => row.map((_, c): EditField => ({ kind: "cell", r, c })));
    default:
      return [];
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The pattern for what is typed in the Find field (it is text, not a pattern), or null for nothing. */
export function buildPattern(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null;
  const word = "[\\p{L}\\p{N}_]";
  const body = escapeRe(query);
  return new RegExp(opts.wholeWord ? `(?<!${word})${body}(?!${word})` : body, opts.matchCase ? "gu" : "giu");
}

export interface Match {
  blockId: string;
  field: EditField;
  fieldId: string;
  /** Which paragraph of a text box (a match is inside one paragraph); 0 for every other text. */
  paragraph: number;
  index: number; // where it starts in the text of the field (or of the paragraph)
  length: number;
  /** A few words around it, for the list. */
  before: string;
  hit: string;
  after: string;
}

const CONTEXT = 28;

// The paragraphs a field is searched in: those of a text box, the whole text of anything else.
function pieces(b: Block, f: EditField): string[] {
  if (b.type === "textbox" && f.kind === "text") return docParagraphs(textboxDoc(b)).map((p) => p.runs.map((r) => r.text).join(""));
  return [plainText(fieldValue(b, f))];
}

/** Every match in the blocks, in the order of the page (at most `limit`). */
export function findAll(blocks: Block[], query: string, opts: FindOptions, limit = 500): Match[] {
  const re = buildPattern(query, opts);
  if (!re) return [];
  const out: Match[] = [];
  for (const b of blocks) {
    for (const field of textFields(b)) {
      pieces(b, field).forEach((text, paragraph) => {
        for (const m of text.matchAll(re)) {
          if (!m[0] || out.length >= limit) continue;
          const at = m.index;
          out.push({
            blockId: b.id,
            field,
            fieldId: fieldKey(field),
            paragraph,
            index: at,
            length: m[0].length,
            before: (at > CONTEXT ? "…" : "") + text.slice(Math.max(0, at - CONTEXT), at),
            hit: m[0],
            after: text.slice(at + m[0].length, at + m[0].length + CONTEXT) + (text.length > at + m[0].length + CONTEXT ? "…" : ""),
          });
        }
      });
    }
  }
  return out;
}

// ---- replacing ----

// The text with the range replaced: the replacement looks like the first letter it replaces.
function replaceRange(rich: string, start: number, end: number, text: string): string {
  const style = styleAt(rich, start, Math.min(start + 1, end));
  return insertRich(deleteRange(rich, start, end), start, text ? serializeRich([{ text, style }]) : "");
}

const asRuns = (rich: string) => parseRich(rich).filter((r) => r.text);

/** The change that replaces one match, as a patch of its block (null when the block no longer has it). */
export function replaceOne(b: Block, m: Match, replacement: string): BlockPatch | null {
  if (b.type === "textbox" && m.field.kind === "text") {
    const paragraphs = docParagraphs(textboxDoc(b));
    const p = paragraphs[m.paragraph];
    if (!p || p.runs.map((r) => r.text).join("").slice(m.index, m.index + m.length) !== m.hit) return null;
    paragraphs[m.paragraph] = { ...p, runs: asRuns(replaceRange(serializeRich(p.runs), m.index, m.index + m.length, replacement)) };
    const content = docFromParagraphs(paragraphs);
    return { content, text: richFromDoc(content) } as BlockPatch;
  }
  const value = fieldValue(b, m.field);
  if (plainText(value).slice(m.index, m.index + m.length) !== m.hit) return null;
  return fieldPatch(b, m.field, replaceRange(value, m.index, m.index + m.length, replacement));
}

/** The change that replaces every match in a block: a patch, and how many there were (null when there are none). */
export function replaceInBlock(b: Block, re: RegExp, replacement: string): { patch: BlockPatch; count: number } | null {
  let count = 0;
  const patch: Record<string, unknown> = {};
  const work: Record<string, unknown> = { ...b };
  for (const field of textFields(b)) {
    const current = work as unknown as Block;
    if (b.type === "textbox" && field.kind === "text") {
      const paragraphs = docParagraphs(textboxDoc(current as typeof b));
      let here = 0;
      const next = paragraphs.map((p) => {
        const r = replaceMatches(serializeRich(p.runs), re, replacement);
        here += r.count;
        return r.count ? { ...p, runs: asRuns(r.value) } : p;
      });
      if (here) {
        count += here;
        const content = docFromParagraphs(next);
        Object.assign(patch, { content, text: richFromDoc(content) });
        Object.assign(work, patch);
      }
      continue;
    }
    const r = replaceMatches(fieldValue(current, field), re, replacement);
    if (!r.count) continue;
    count += r.count;
    const part = fieldPatch(current, field, r.value) as Record<string, unknown>;
    Object.assign(patch, part);
    Object.assign(work, part);
  }
  return count ? { patch: patch as BlockPatch, count } : null;
}

/** The changes that replace every match in the blocks, one per block that has some, and how many matches there were. */
export function replaceAll(blocks: Block[], query: string, opts: FindOptions, replacement: string): { patches: { id: string; patch: BlockPatch }[]; count: number } {
  const re = buildPattern(query, opts);
  const patches: { id: string; patch: BlockPatch }[] = [];
  let count = 0;
  if (re) {
    for (const b of blocks) {
      const r = replaceInBlock(b, re, replacement);
      if (r) {
        patches.push({ id: b.id, patch: r.patch });
        count += r.count;
      }
    }
  }
  return { patches, count };
}

// Formatting the whole text of a block from the right panel (the block is selected, no words are): what the
// editors do to selected words, done to all the words of the block. A block in, a patch out, so it can be tested
// without a browser. (A text block is a styled string, a text box a Tiptap document that keeps the same string.)

import type { JSONContent } from "@tiptap/core";
import { applyStyle, joinParagraphs, mapChars, plainLength, plainText, splitParagraphs, styleAt, type RunStyle, type StylePatch } from "./richText";
import { caseChars, cycleCase, type CaseMode } from "./textCase";
import { mapDocChars, richFromDoc, setParagraphs, sortDocParagraphs, styleDoc, textboxDoc, type DocParagraph, type ParagraphChanges } from "./textboxDoc";
import type { Block, TextBlock, TextboxBlock } from "./types";

export type TextualBlock = TextBlock | TextboxBlock;
export const isTextual = (b: Block): b is TextualBlock => b.type === "text" || b.type === "textbox";

// What all the words of the block share (a script, a highlight…): the state of the buttons when the block is the target.
export const wholeStyle = (b: TextualBlock): RunStyle => styleAt(b.text, 0, plainLength(b.text));

// What changes in a block: its text (a styled string) and, for a text box, the document it keeps (`text` is the same text
// as styled runs, kept up to date from it). Both kinds of block take it as a patch.
export interface TextPatch {
  text?: string;
  content?: JSONContent;
}

const docPatch = (doc: JSONContent): TextPatch => ({ content: doc, text: richFromDoc(doc) });

// The formatting of every paragraph of a text box changed (a list, a shading…): the same for all, or by a function of each.
export const paragraphsBlock = (b: TextboxBlock, changes: ParagraphChanges | ((p: DocParagraph, i: number) => ParagraphChanges)): TextPatch => docPatch(setParagraphs(textboxDoc(b), changes));

// Every word of the block with a style changed, or with no style at all ("clear").
export function styleBlock(b: TextualBlock, patch: StylePatch | "clear"): TextPatch {
  if (b.type === "text") return { text: applyStyle(b.text, 0, plainLength(b.text), patch) };
  return docPatch(styleDoc(textboxDoc(b), patch));
}

// Every word a subscript or a superscript (undefined = neither).
export const scriptBlock = (b: TextualBlock, script?: "sub" | "sup") => styleBlock(b, { sub: script === "sub" ? true : null, sup: script === "sup" ? true : null });

// Every word highlighted (undefined = no highlight).
export const highlightBlock = (b: TextualBlock, color?: string) => styleBlock(b, { hl: color ?? null });

// The letters of every word in another case. null when the text already is in it (nothing to change).
export function caseBlock(b: TextualBlock, mode: CaseMode | "cycle"): TextPatch | null {
  const picked = mode === "cycle" ? cycleCase(plainText(b.text)) : mode;
  const fn = (chars: string[]) => caseChars(chars, picked);
  if (b.type === "text") {
    const text = mapChars(b.text, 0, plainLength(b.text), fn);
    return text === b.text ? null : { text };
  }
  const doc = mapDocChars(textboxDoc(b), fn);
  const patch = docPatch(doc);
  return patch.text === b.text ? null : patch;
}

// The lines of a text block, or the paragraphs of a text box, in alphabetical order (numbers counted as numbers). null for one line.
export function sortBlock(b: TextualBlock, order: "asc" | "desc", locale: string): TextPatch | null {
  if (b.type === "textbox") {
    const sorted = sortDocParagraphs(textboxDoc(b), order, locale);
    const patch = docPatch(sorted);
    return patch.text === b.text ? null : patch;
  }
  const lines = splitParagraphs(b.text);
  if (lines.length < 2) return null;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const sorted = [...lines].sort((x, y) => (order === "asc" ? 1 : -1) * collator.compare(plainText(x).trim(), plainText(y).trim()));
  const text = joinParagraphs(sorted);
  return text === b.text ? null : { text };
}

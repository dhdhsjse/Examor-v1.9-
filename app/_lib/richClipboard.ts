// Copying and pasting formatted text, in the two editors (the plain-text one of paragraphs, questions…, and the text
// box's) and between them and other programs. The app puts HTML on the clipboard with the paragraphs themselves
// riding in an attribute, so copying inside the app loses nothing; what comes from other programs is read from its
// HTML (clipboardHtml.ts) and, by default, keeps the emphasis and the lists but takes the exam's font, sizes and colors,
// like Word's "Merge formatting".

import { htmlToParagraphs, paragraphsToHtml, paragraphsToText } from "./clipboardHtml";
import { listMarkers } from "./lists";
import { parseRich, serializeRich, splitParagraphs, type RunStyle } from "./richText";
import type { DocParagraph } from "./textboxDoc";

// What the paste keeps (Paste ▾): everything; the emphasis and the lists; the text only. Missing = by where it comes from.
export type PasteMode = "source" | "merge" | "text";

/** What a clipboard offers (the two flavors every program writes). */
export interface ClipSource {
  html?: string;
  text?: string;
}

const PAYLOAD = /data-examor-clip="([^"]*)"/;

const blank = (runs: DocParagraph["runs"]): DocParagraph => ({ runs, indent: 0, spaceBefore: 0, spaceAfter: 0 });

// ---- copying ----

/** The HTML and the text a copy of these paragraphs puts on the clipboard. */
export function clipFromParagraphs(paragraphs: DocParagraph[]): Required<ClipSource> {
  const payload = encodeURIComponent(JSON.stringify({ v: 1, paragraphs }));
  return { html: paragraphsToHtml(paragraphs, payload), text: paragraphsToText(paragraphs) };
}

// ---- pasting ----

// The paragraphs a copy of the app wrote, exactly (null when this clipboard is not one).
function payloadOf(html: string): DocParagraph[] | null {
  const m = PAYLOAD.exec(html);
  if (!m) return null;
  try {
    const data = JSON.parse(decodeURIComponent(m[1])) as { v?: number; paragraphs?: unknown };
    if (data.v !== 1 || !Array.isArray(data.paragraphs)) return null;
    return data.paragraphs.map((p: Partial<DocParagraph>) => ({ ...p, indent: p.indent ?? 0, spaceBefore: p.spaceBefore ?? 0, spaceAfter: p.spaceAfter ?? 0, runs: Array.isArray(p.runs) ? p.runs : [] }));
  } catch {
    return null;
  }
}

/** Lines of plain text as paragraphs. */
export const textToParagraphs = (text: string): DocParagraph[] =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => blank(line ? [{ text: line, style: {} }] : []));

const EMPHASIS: (keyof RunStyle)[] = ["b", "i", "u", "x", "sub", "sup"];

// Neighbours with the same style are one run.
const mergeRuns = (runs: DocParagraph["runs"]): DocParagraph["runs"] =>
  runs.reduce<DocParagraph["runs"]>((out, r) => {
    const last = out[out.length - 1];
    if (last && JSON.stringify(last.style) === JSON.stringify(r.style)) last.text += r.text;
    else out.push({ text: r.text, style: r.style });
    return out;
  }, []);

/** The paragraphs with only what `mode` keeps. */
export function applyPasteMode(paragraphs: DocParagraph[], mode: PasteMode): DocParagraph[] {
  if (mode === "source") return paragraphs;
  return paragraphs.map((p) => {
    const runs = mergeRuns(p.runs.map((r) => ({ text: r.text, style: mode === "text" ? {} : (Object.fromEntries(EMPHASIS.filter((k) => r.style[k]).map((k) => [k, true])) as RunStyle) })));
    return mode === "text" ? blank(runs) : { ...blank(runs), ...(p.list ? { list: p.list } : {}), indent: p.indent };
  });
}

/**
 * What a paste puts in the text: the app's own copy exactly, other programs' HTML with its emphasis and lists, or the plain
 * text. With a `mode`, only that much of it. null when the clipboard has nothing to paste.
 */
export function readClip(src: ClipSource, mode?: PasteMode): DocParagraph[] | null {
  const html = src.html ?? "";
  const text = src.text ?? "";
  if (mode === "text") {
    if (text) return textToParagraphs(text);
    const paragraphs = html.trim() ? (payloadOf(html) ?? htmlToParagraphs(html)) : [];
    return paragraphs.length ? applyPasteMode(paragraphs, "text") : null;
  }
  const own = html ? payloadOf(html) : null;
  const paragraphs = own ?? (html.trim() ? htmlToParagraphs(html) : null);
  if (paragraphs?.length) return applyPasteMode(paragraphs, mode ?? (own ? "source" : "merge"));
  return text ? textToParagraphs(text) : null;
}

// ---- the plain-text editor: a styled string, one line per paragraph ----

/** A styled string (richText.ts) as paragraphs. */
export const paragraphsFromRich = (rich: string): DocParagraph[] => splitParagraphs(rich).map((s) => blank(parseRich(s).filter((r) => r.text)));

/**
 * Paragraphs as a styled string for a text that has no paragraphs of its own: one line each (one line in all for a field of one
 * line), the markers of their lists written out ("• a", "1. b").
 */
export function richFromParagraphs(paragraphs: DocParagraph[], multiline: boolean): string {
  const markers = listMarkers(paragraphs.map((p) => ({ list: p.list ?? null, level: p.indent })));
  const lines = paragraphs.map((p, i) => (markers[i] ? `${markers[i]} ` : "") + serializeRich(p.runs));
  return multiline ? lines.join("\n") : lines.join(" ").replace(/\n/g, " ");
}

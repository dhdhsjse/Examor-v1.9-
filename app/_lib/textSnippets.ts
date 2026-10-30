// Question types typed into a text box (a free question, or any text box being typed in): picking a question
// type in Insert → Questions while a text box is open adds that question's answer layout inside the box,
// as plain lines of text (boxes to tick, dotted lines, lists to link…), instead of adding a new block.
// The canvas draws them like the rest of the box's text, so they print as they look.

import type { Editor, JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { nextTaskTitle } from "./blocks";
import type { ToolAction } from "./tools";
import type { Block, BlockType, Lang } from "./types";

// The lines a question type adds, and where the cursor goes after: in paragraph `focus.line`, after
// `focus.at` characters (missing = at its end). `inline` text goes where the cursor is, inside the line.
export interface Snippet {
  lines?: JSONContent[];
  inline?: string;
  focus?: { line: number; at?: number };
}

// What a snippet needs to know about the box it goes in.
export interface SnippetContext {
  lang: Lang;
  blocks: Block[]; // the exam's blocks (exercise titles are numbered after the ones already there)
  dotsPerLine: number; // dots that fill one line of the box
}

const BOX = "☐";

const WORDS = {
  fr: { letters: ["a", "b", "c", "d"], true: "Vrai", false: "Faux", colA: "Colonne A :", colB: "Colonne B :", words: "Mots :", group: "Groupe" },
  ar: { letters: ["أ", "ب", "ج", "د"], true: "صحيح", false: "خطأ", colA: "العمود أ :", colB: "العمود ب :", words: "الكلمات :", group: "المجموعة" },
};

const text = (s: string, marks?: JSONContent["marks"]): JSONContent[] => (s ? [{ type: "text", text: s, ...(marks ? { marks } : {}) }] : []);
const line = (s: string, opts: { indent?: number; bold?: boolean } = {}): JSONContent => ({
  type: "paragraph",
  ...(opts.indent ? { attrs: { indent: opts.indent } } : {}),
  ...(s ? { content: text(s, opts.bold ? [{ type: "bold" }] : undefined) } : {}),
});

// The question types that can go inside a text box (the task title is a bold line).
const SNIPPETS: Partial<Record<BlockType, (c: SnippetContext) => Snippet>> = {
  mcq: ({ lang }) => ({
    lines: WORDS[lang].letters.map((l) => line(`${BOX} ${l}) `, { indent: 1 })),
    focus: { line: 0 },
  }),
  truefalse: ({ lang }) => {
    const w = WORDS[lang];
    const tail = `   ( ${BOX} ${w.true}   ${BOX} ${w.false} )`;
    return { lines: [1, 2, 3].map(() => line(`• ${tail}`, { indent: 1 })), focus: { line: 0, at: 2 } };
  },
  blank: () => ({ inline: " ………………… " }),
  open: ({ dotsPerLine }) => ({
    lines: [...[1, 2, 3].map(() => line(".".repeat(dotsPerLine))), line("")],
    focus: { line: 3 },
  }),
  match: ({ lang }) => {
    const w = WORDS[lang];
    return {
      lines: [line(w.colA, { bold: true }), ...[1, 2, 3].map((n) => line(`${n}. `, { indent: 1 })), line(w.colB, { bold: true }), ...w.letters.slice(0, 3).map((l) => line(`${l}. `, { indent: 1 }))],
      focus: { line: 1 },
    };
  },
  order: () => ({ lines: [1, 2, 3, 4].map(() => line("(    ) ", { indent: 1 })), focus: { line: 0 } }),
  classify: ({ lang }) => {
    const w = WORDS[lang];
    return { lines: [line(`${w.words} `), line(`${w.group} 1 : `, { bold: true }), line(`${w.group} 2 : `, { bold: true })], focus: { line: 0 } };
  },
};

const isTaskTitle = (a: ToolAction) => a.kind === "block" && a.type === "text" && (a.preset as { style?: string } | undefined)?.style === "heading";

// Whether a tool adds its question inside the text box being typed in (instead of a new block).
export const goesInText = (a: ToolAction | undefined) => !!a && a.kind === "block" && (isTaskTitle(a) || !!SNIPPETS[a.type]);

// The snippet a tool adds inside a text box, or null when it adds a block as usual.
export function snippetFor(a: ToolAction, c: SnippetContext): Snippet | null {
  if (a.kind !== "block") return null;
  if (isTaskTitle(a)) return { lines: [line(nextTaskTitle(c.blocks, c.lang), { bold: true }), line("")], focus: { line: 1 } };
  return SNIPPETS[a.type]?.(c) ?? null;
}

// How many dots fill one line `width` px wide in this font (measured in the browser).
export function dotsFor(width: number, font: string): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 60;
  ctx.font = font;
  const dot = ctx.measureText(".").width || 4;
  return Math.max(10, Math.floor((width * 0.97) / dot));
}

// Put a snippet in the editor. Its lines never cut the text: they replace the line the cursor is in when it is
// empty, else they go under it. One undo step.
export function insertSnippet(editor: Editor, s: Snippet) {
  if (s.inline) {
    editor.chain().focus().insertContent(s.inline).run();
    return;
  }
  const lines = s.lines ?? [];
  if (!lines.length) return;
  const { state } = editor;
  // (the whole text selected, as in a new box, starts before its first line: that line)
  const sel = state.selection.$from;
  const $from = sel.depth ? sel : state.doc.resolve(Math.min(sel.pos + 1, state.doc.content.size));
  const start = $from.before(1);
  const end = $from.after(1);
  const nodes = lines.map((l) => state.schema.nodeFromJSON(l));
  const tr = state.tr;
  const empty = $from.parent.content.size === 0;
  if (empty) tr.replaceWith(start, end, nodes);
  else tr.insert(end, nodes);
  // The cursor: in the line to fill first.
  const at = empty ? start : end;
  const focus = Math.min(s.focus?.line ?? lines.length - 1, nodes.length - 1);
  let pos = at;
  for (let i = 0; i < focus; i++) pos += nodes[i].nodeSize;
  const size = nodes[focus].content.size;
  pos += 1 + Math.min(s.focus?.at ?? size, size);
  tr.setSelection(TextSelection.create(tr.doc, pos));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

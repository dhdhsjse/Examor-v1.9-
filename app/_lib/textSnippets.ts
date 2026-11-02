// What picking a tool in Insert does while a text box is being typed in. The question types and the table go inside the text as real
// blocks (textboxSlots.ts). The exercise title is only a line of text: it goes in as a bold line, at the cursor.

import type { Editor, JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { nextTaskTitle } from "./blocks";
import { canEmbed } from "./textboxSlots";
import type { ToolAction } from "./tools";
import type { Block, Lang } from "./types";

// The lines a tool adds, and where the cursor goes after: in paragraph `focus.line`.
export interface Snippet {
  lines: JSONContent[];
  focus: { line: number };
}

// What a snippet needs to know about the box it goes in.
export interface SnippetContext {
  lang: Lang;
  blocks: Block[]; // the exam's blocks (exercise titles are numbered after the ones already there)
}

const line = (s: string, bold = false): JSONContent => ({
  type: "paragraph",
  ...(s ? { content: [{ type: "text", text: s, ...(bold ? { marks: [{ type: "bold" }] } : {}) }] } : {}),
});

const isTaskTitle = (a: ToolAction) => a.kind === "block" && a.type === "text" && (a.preset as { style?: string } | undefined)?.style === "heading";

// Whether a tool adds its content inside the text box being typed in (instead of a new block on the page).
export const goesInText = (a: ToolAction | undefined) => !!a && a.kind === "block" && (isTaskTitle(a) || canEmbed(a.type));

// The lines a tool adds inside a text box as plain text, or null when it adds a block (or nothing) as usual.
export function snippetFor(a: ToolAction, c: SnippetContext): Snippet | null {
  if (!isTaskTitle(a)) return null;
  return { lines: [line(nextTaskTitle(c.blocks, c.lang), true), line("")], focus: { line: 1 } };
}

// Put a snippet in the editor. Its lines never cut the text: they replace the line the cursor is in when it is
// empty, else they go under it. One undo step.
export function insertSnippet(editor: Editor, s: Snippet) {
  const { state } = editor;
  // (the whole text selected, as in a new box, starts before its first line: that line)
  const sel = state.selection.$from;
  const $from = sel.depth ? sel : state.doc.resolve(Math.min(sel.pos + 1, state.doc.content.size));
  const start = $from.before(1);
  const end = $from.after(1);
  const nodes = s.lines.map((l) => state.schema.nodeFromJSON(l));
  const tr = state.tr;
  const empty = $from.parent.content.size === 0;
  if (empty) tr.replaceWith(start, end, nodes);
  else tr.insert(end, nodes);
  // The cursor: in the line to fill first.
  const at = empty ? start : end;
  const focus = Math.min(s.focus.line, nodes.length - 1);
  let pos = at;
  for (let i = 0; i < focus; i++) pos += nodes[i].nodeSize;
  tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

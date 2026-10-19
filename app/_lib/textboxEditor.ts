// The Tiptap editor of a text box (workspace/TextboxEditor.tsx): its extensions, the formatting of the
// selection, and the commands the format bar and the right panel send to it.

import type { Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { IndentExtension } from "./tiptap-indent";
import type { ParagraphAlign } from "./types";

// Only what the canvas can draw (textboxDoc.ts): paragraphs, line breaks, bold / italic / underline /
// strikethrough, font, size, color, highlight, paragraph alignment and indent, and undo. Pasted headings, lists…
// arrive as plain paragraphs.
export const textboxExtensions = () => [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    trailingNode: false,
    dropcursor: false,
    gapcursor: false,
  }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }),
  IndentExtension,
];

export type StyleMark = "bold" | "italic" | "underline" | "strike";

// The formatting at the selection (only what the words themselves carry; the box's own comes on top).
export interface SelectionFormat {
  marks: Record<StyleMark, boolean>;
  family?: string;
  size?: number;
  color?: string;
  highlight?: string;
  align?: ParagraphAlign;
  indent: { min: number; max: number }; // levels of the paragraphs of the selection
}

const ALIGNS: ParagraphAlign[] = ["left", "center", "right", "justify"];

// The smallest and largest indent among the paragraphs of the selection (getAttributes gives only one).
function selectionIndent(editor: Editor) {
  const { from, to } = editor.state.selection;
  const levels: number[] = [];
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name !== "paragraph") return;
    levels.push(Number(node.attrs.indent) || 0);
    return false;
  });
  return levels.length ? { min: Math.min(...levels), max: Math.max(...levels) } : { min: 0, max: 0 };
}

export function selectionFormat(editor: Editor): SelectionFormat {
  const style = editor.getAttributes("textStyle");
  const size = parseFloat(style.fontSize ?? "");
  const align = editor.getAttributes("paragraph").textAlign;
  return {
    marks: { bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), strike: editor.isActive("strike") },
    family: typeof style.fontFamily === "string" && style.fontFamily ? style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "") : undefined,
    size: size > 0 ? size : undefined,
    color: style.color || undefined,
    highlight: editor.isActive("highlight") ? (editor.getAttributes("highlight").color ?? "#fef08a") : undefined,
    align: ALIGNS.includes(align) ? align : undefined,
    indent: selectionIndent(editor),
  };
}

// The selected words (or what is typed next) get these; undefined = back to the box's own.
export const setFamily = (editor: Editor, family?: string) =>
  family ? editor.chain().focus().setFontFamily(family).run() : editor.chain().focus().unsetFontFamily().run();
export const setSize = (editor: Editor, size?: number) =>
  size ? editor.chain().focus().setFontSize(`${size}px`).run() : editor.chain().focus().unsetFontSize().run();
export const setColor = (editor: Editor, color?: string) => (color ? editor.chain().focus().setColor(color).run() : editor.chain().focus().unsetColor().run());
export const setHighlight = (editor: Editor, color?: string) =>
  color ? editor.chain().focus().setHighlight({ color }).run() : editor.chain().focus().unsetHighlight().run();
// Alignment of the paragraphs of the selection (undefined = the box's).
export const setAlign = (editor: Editor, align?: ParagraphAlign) =>
  align ? editor.chain().focus().setTextAlign(align).run() : editor.chain().focus().unsetTextAlign().run();
// Indent of the paragraphs of the selection, one level more or less.
export const indent = (editor: Editor) => editor.chain().focus().indent().run();
export const outdent = (editor: Editor) => editor.chain().focus().outdent().run();
export const clearMarks = (editor: Editor) => editor.chain().focus().unsetAllMarks().run();

// Bold / italic / underline / strikethrough of the selection. When the whole box has it (`boxHas`), the
// words cannot drop it alone: every word gets it as its own instead, the box's is removed (`dropBoxStyle`),
// then the selection loses it. The text looks the same, except the selection.
export function toggleStyle(editor: Editor, mark: StyleMark, boxHas: boolean, dropBoxStyle: () => void) {
  if (!boxHas) return editor.chain().focus().toggleMark(mark).run();
  dropBoxStyle();
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      tr.addMark(0, tr.doc.content.size, state.schema.marks[mark].create());
      return true;
    })
    .unsetMark(mark)
    .run();
}

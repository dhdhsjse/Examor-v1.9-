// Word's "Increase indent" / "Decrease indent" for the text box editor: an `indent` level on paragraphs,
// INDENT_PX each, from the start side (the right in Arabic). The canvas draws the same indent
// (layoutTextbox, through textboxDoc.ts). Ctrl+M / Ctrl+Shift+M as in Word.

import { Extension, type CommandProps } from "@tiptap/core";

export const INDENT_PX = 24; // per level
export const MAX_INDENT = 10;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      // Increase the indentation of the paragraph(s) of the selection.
      indent: () => ReturnType;
      // Decrease it (not below 0).
      outdent: () => ReturnType;
    };
  }
}

export const IndentExtension = Extension.create<{ types: string[] }>({
  name: "indent",

  addOptions() {
    return { types: ["paragraph"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            // Pasted text: its start margin, in levels.
            parseHTML: (element) => {
              const margin = parseFloat(element.style.marginInlineStart || element.style.marginLeft || "0");
              return Math.max(0, Math.min(MAX_INDENT, Math.round(margin / INDENT_PX)));
            },
            renderHTML: (attributes) => (attributes.indent ? { style: `margin-inline-start: ${attributes.indent * INDENT_PX}px` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    // Every paragraph of the selection (the one with the cursor when nothing is selected) moves by `step`
    // levels. Nothing to change (already at 0 or at the most) = the command does nothing.
    const shift =
      (step: number) =>
      ({ tr, state, dispatch }: CommandProps) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!this.options.types.includes(node.type.name)) return;
          const level = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent ?? 0) + step));
          if (level === (node.attrs.indent ?? 0)) return false;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: level });
          changed = true;
          return false; // a paragraph holds only text
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return { indent: () => shift(1), outdent: () => shift(-1) };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-m": () => this.editor.commands.indent(),
      "Mod-Shift-m": () => this.editor.commands.outdent(),
    };
  },
});

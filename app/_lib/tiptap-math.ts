// Formulas inside the text of a text box (inlineMath.ts): an inline node of the document, shown in the editor as a MathLive field among
// the words. Typing in it (or the math keyboard, through activeMathfield.ts) writes the formula; the arrows walk out of it into the text;
// a formula left empty goes away. The node keeps its size as MathJax draws it, so the canvas can lay the line out at once.

import { Node, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";
import type { MathfieldElement } from "mathlive";
import { clearActiveMathfield, setActiveMathfield } from "./activeMathfield";
import { dropCurrentFormula, getCurrentFormula, setCurrentFormula } from "./currentFormula";
import { measureInlineMath } from "./inlineMath";
import { INLINE_MATH } from "./textboxDoc";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineMath: {
      /** A new, empty formula at the cursor, its field focused at once (the keys typed next go in it). */
      insertInlineMath: () => ReturnType;
    };
  }
}

// The next formula view made is the one just inserted: it takes the focus as soon as its field is ready.
let focusNext = false;

export const InlineMath = Node.create({
  name: INLINE_MATH,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
      w: { default: null },
      h: { default: null },
      d: { default: null },
      svg: { default: null }, // the drawing (inlineMath.ts), kept so the page draws it without MathJax
    };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-math]", getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute("data-latex") ?? "" }) }];
  },

  renderHTML({ node }) {
    return ["span", { "data-inline-math": "", "data-latex": node.attrs.latex }];
  },

  renderText({ node }) {
    return `$${node.attrs.latex}$`;
  },

  addCommands() {
    return {
      insertInlineMath:
        () =>
        ({ commands }) => {
          focusNext = true;
          return commands.insertContent({ type: this.name, attrs: { latex: "" } });
        },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => new MathView(node, getPos as () => number | undefined, editor);
  },
});

let lastId = 0;

class MathView implements NodeView {
  dom: HTMLElement;
  private field: MathfieldElement | null = null;
  private latex: string;
  private measuring = 0;
  private readonly id = ++lastId; // (for the Properties panel, which shows the formula being edited: currentFormula.ts)

  constructor(
    private node: PMNode,
    private getPos: () => number | undefined,
    private editor: Editor,
  ) {
    this.latex = node.attrs.latex;
    this.dom = document.createElement("span");
    this.dom.className = "inline-math";
    this.dom.dir = "ltr"; // a formula reads left to right, also in an Arabic sentence
    this.dom.contentEditable = "false";
    const focus = focusNext;
    focusNext = false;
    void import("mathlive").then(({ MathfieldElement }) => {
      if (!this.dom.isConnected && !focus) return;
      MathfieldElement.fontsDirectory = "/mathlive/fonts";
      MathfieldElement.soundsDirectory = null;
      const field = new MathfieldElement();
      field.mathVirtualKeyboardPolicy = "manual"; // our own keyboard, never MathLive's
      field.mathModeSpace = "\\:"; // the space bar puts a space in the formula (MathLive ignores it otherwise)
      field.value = this.latex;
      field.addEventListener("input", () => this.commit());
      field.addEventListener("focus", () => {
        setActiveMathfield({ field, onInput: () => this.commit() });
        this.share();
      });
      field.addEventListener("blur", () => this.left());
      field.addEventListener("move-out", (e) => this.moveOut(e as CustomEvent<{ direction: string }>));
      // Escape leaves the formula for the text after it (a second Escape, in the text, closes the box).
      field.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        this.placeCursor(true);
      });
      this.dom.appendChild(field);
      this.field = field;
      if (focus) field.focus();
    });
  }

  // This formula is the one the Properties panel shows (and writes in).
  private share() {
    setCurrentFormula({
      id: this.id,
      latex: this.latex,
      setLatex: (latex) => {
        this.field?.setValue(latex, { silenceNotifications: true });
        this.commit(latex);
      },
    });
  }

  // The formula typed: kept in the node, then its size once MathJax has drawn it (no step of its own in the undo history).
  private commit(value = this.field?.value) {
    if (value === undefined || value === this.latex) return;
    this.latex = value;
    if (getCurrentFormula()?.id === this.id) this.share();
    this.setAttrs({ latex: this.latex, svg: null }, true);
    const asked = ++this.measuring;
    const latex = this.latex;
    void measureInlineMath(latex).then((m) => {
      if (asked === this.measuring && latex === this.latex) this.setAttrs({ w: m.w, h: m.h, d: m.d, svg: m.svg }, false);
    });
  }

  private setAttrs(attrs: Record<string, unknown>, history: boolean) {
    const pos = this.getPos();
    if (pos === undefined) return;
    const { state, view } = this.editor;
    const tr = state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, ...attrs });
    if (!history) tr.setMeta("addToHistory", false);
    view.dispatch(tr);
  }

  // The field lost the focus: the keyboard no longer types in it; an empty formula is taken out of the text.
  private left() {
    if (this.field) clearActiveMathfield(this.field);
    if (this.latex.trim()) return;
    const pos = this.getPos();
    if (pos === undefined || !this.dom.isConnected) return;
    this.editor.view.dispatch(this.editor.state.tr.delete(pos, pos + this.node.nodeSize));
  }

  // ← at its start or → at its end: the cursor goes on in the text, before or after the formula.
  private moveOut(e: CustomEvent<{ direction: string }>) {
    e.preventDefault();
    this.placeCursor(e.detail.direction === "forward" || e.detail.direction === "downward");
  }

  // The cursor in the text, just after (or before) the formula.
  private placeCursor(after: boolean) {
    const pos = this.getPos();
    if (pos === undefined) return;
    const { state, view } = this.editor;
    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, after ? pos + this.node.nodeSize : pos)));
    view.focus();
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (node.attrs.latex !== this.latex) {
      this.latex = node.attrs.latex; // undo, redo
      this.field?.setValue(this.latex, { silenceNotifications: true });
      if (getCurrentFormula()?.id === this.id) this.share();
    }
    return true;
  }

  // Reached with the arrows from the text (the node is selected): typing goes on inside the formula.
  selectNode() {
    this.field?.focus();
  }

  deselectNode() {}

  // The field handles its own keys, clicks and selection; ProseMirror leaves them alone.
  stopEvent() {
    return true;
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    if (this.field) clearActiveMathfield(this.field);
    dropCurrentFormula(this.id);
    this.field?.remove();
  }
}

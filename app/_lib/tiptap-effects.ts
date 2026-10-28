// The underline and the text effects of the text box editor (Word's Underline ▾ and Text effects). StarterKit's underline is left out of
// the editor and replaced by one with the same name, keys and commands that also has a `style` (double, dotted, dashed, wavy); and
// an effect (a shadow, an outline or a glow) is a mark of its own, one at a time. Both are drawn on the page by RichText.

import { Mark, mergeAttributes } from "@tiptap/core";
import { EFFECT_CSS, isTextEffect, isUnderlineStyle } from "./richText";

// A style object as the text of a style attribute ("textShadow" → "text-shadow", "webkitTextStroke" → "-webkit-text-stroke").
const cssText = (css: Partial<CSSStyleDeclaration>) =>
  Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^webkit/, "-webkit")}: ${v}`)
    .join("; ");

export const StyledUnderline = Mark.create({
  name: "underline",

  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => (isUnderlineStyle(el.style.textDecorationStyle) ? el.style.textDecorationStyle : null),
        renderHTML: (attrs: Record<string, unknown>) => (isUnderlineStyle(attrs.style) ? { style: `text-decoration-style: ${attrs.style}` } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "u" }, { style: "text-decoration", consuming: false, getAttrs: (value) => (typeof value === "string" && value.includes("underline") ? {} : false) }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["u", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setUnderline: () => ({ commands }) => commands.setMark(this.name),
      toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name),
      unsetUnderline: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-u": () => this.editor.commands.toggleUnderline(),
      "Mod-U": () => this.editor.commands.toggleUnderline(),
    };
  },
});

export const TextEffect = Mark.create({
  name: "textEffect",

  addAttributes() {
    return {
      kind: {
        default: "shadow",
        parseHTML: (el: HTMLElement) => (isTextEffect(el.dataset.fx) ? el.dataset.fx : null),
        renderHTML: (attrs: Record<string, unknown>) => (isTextEffect(attrs.kind) ? { "data-fx": attrs.kind, style: cssText(EFFECT_CSS[attrs.kind]) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-fx]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

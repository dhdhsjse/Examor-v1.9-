// The paragraph formatting of the text box editor beyond alignment and indent (tiptap-indent.ts): the list a
// paragraph belongs to, its direction, line spacing, the space before and after it, its shading and its borders;
// and the markers of the lists, drawn from the same numbering as the canvas (lists.ts), as a decoration of
// each item (`data-marker`, shown by CSS) so nothing of them is in the document.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { LIST_GAP, isListKind, listMarkers, type ListItem } from "./lists";
import { cleanLineHeight, cleanSides, clampSpace, isDirection } from "./paragraphFormat";

// The normal line of a text box is this many times its font size (blockLayout.textboxSpec); a paragraph's own
// line spacing is a multiple of it.
export const LINE_RATIO = 20 / 14;

const BORDER_CSS: Record<string, string> = { t: "border-top", b: "border-bottom", l: "border-inline-start", r: "border-inline-end" };

export const ParagraphFormatExtension = Extension.create({
  name: "paragraphFormat",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          list: {
            default: null,
            parseHTML: (el: HTMLElement) => (isListKind(el.dataset.list) ? el.dataset.list : null),
            renderHTML: (a: Record<string, unknown>) => (isListKind(a.list) ? { "data-list": a.list } : {}),
          },
          dir: {
            default: null,
            parseHTML: (el: HTMLElement) => (isDirection(el.getAttribute("dir")) ? el.getAttribute("dir") : null),
            renderHTML: (a: Record<string, unknown>) => (isDirection(a.dir) ? { dir: a.dir } : {}),
          },
          lineHeight: {
            default: null,
            renderHTML: (a: Record<string, unknown>) => (cleanLineHeight(a.lineHeight) ? { style: `line-height: ${(LINE_RATIO * (cleanLineHeight(a.lineHeight) as number)).toFixed(4)}` } : {}),
          },
          spaceBefore: {
            default: null,
            renderHTML: (a: Record<string, unknown>) => (clampSpace(a.spaceBefore) ? { style: `margin-top: ${clampSpace(a.spaceBefore)}px` } : {}),
          },
          spaceAfter: {
            default: null,
            renderHTML: (a: Record<string, unknown>) => (clampSpace(a.spaceAfter) ? { style: `margin-bottom: ${clampSpace(a.spaceAfter)}px` } : {}),
          },
          shading: {
            default: null,
            renderHTML: (a: Record<string, unknown>) => (typeof a.shading === "string" && a.shading ? { style: `background-color: ${a.shading}` } : {}),
          },
          // The sides of the border, drawn in the color of `borderColor` (the other attribute is only there to keep it).
          border: {
            default: null,
            renderHTML: (a: Record<string, unknown>) => {
              const sides = cleanSides(a.border);
              if (!sides) return {};
              const color = typeof a.borderColor === "string" && a.borderColor ? a.borderColor : "#111827";
              return { style: [...sides].map((s) => `${BORDER_CSS[s]}: 1px solid ${color}`).join("; ") };
            },
          },
          borderColor: { default: null, renderHTML: () => ({}) },
        },
      },
    ];
  },
});

/** What the markers need to know of the box: whether it is written right to left (Arabic letters), and its font size (room for a wide marker). */
export type ListOptions = { rtl: boolean; size: number };

// A guess of the room a marker needs, so the text of the item does not run under a wide one ("viii.").
const gapFor = (marker: string, size: number) => Math.max(LIST_GAP, Math.ceil(marker.length * size * 0.55) + 6);

export const listMarkerKey = new PluginKey("listMarkers");

// The markers of the lists: each item is decorated with its marker and the room it needs (see the CSS of the editor).
export const ListMarkersExtension = Extension.create<ListOptions>({
  name: "listMarkers",

  addOptions() {
    return { rtl: false, size: 14 };
  },

  addProseMirrorPlugins() {
    const { rtl, size } = this.options;
    return [
      new Plugin({
        key: listMarkerKey,
        props: {
          decorations: (state) => {
            const items: { pos: number; size: number; item: ListItem }[] = [];
            state.doc.forEach((node, offset) => {
              if (node.type.name !== "paragraph") return;
              const own = isDirection(node.attrs.dir) ? node.attrs.dir === "rtl" : rtl;
              items.push({ pos: offset, size: node.nodeSize, item: { list: isListKind(node.attrs.list) ? node.attrs.list : null, level: Number(node.attrs.indent) || 0, arabic: own } });
            });
            const markers = listMarkers(items.map((i) => i.item));
            const decorations = items.flatMap((it, i) => {
              const marker = markers[i];
              return marker ? [Decoration.node(it.pos, it.pos + it.size, { "data-marker": marker, style: `--list-gap: ${gapFor(marker, size)}px` })] : [];
            });
            return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
          },
        },
      }),
    ];
  },
});

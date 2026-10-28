// The SVG of a shape (and of a list of them): what goes into the picture a Studio puts on the page. The same parts, colors and
// text lines the Konva canvases draw. Pure functions, unit-tested.
import { SHAPE_FONT, dashArray, paintFill, resolveStyle, shapeParts } from "./geometry";
import { num } from "./path";
import { layoutShapeText } from "./text";
import type { ShapeItem } from "./types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The svg elements of one shape, in the coordinates of the Studio's drawing. */
export function shapeSvg(item: ShapeItem): string {
  const { stroke, strokeWidth } = resolveStyle(item);
  const dash = dashArray(item);
  const parts = shapeParts(item, item.w, item.h)
    .map((p) => {
      const fill = paintFill(p.paint, item);
      const dashed = dash && p.paint !== "solid" ? ` stroke-dasharray="${dash.map(num).join(" ")}"` : "";
      return `<path d="${p.d}" fill="${fill ? esc(fill) : "none"}"${stroke ? ` stroke="${esc(stroke)}" stroke-width="${num(strokeWidth)}"${dashed} stroke-linejoin="round" stroke-linecap="round"` : ""}/>`;
    })
    .join("");
  const flip = item.flipX || item.flipY ? ` transform="translate(${item.flipX ? num(item.w) : 0} ${item.flipY ? num(item.h) : 0}) scale(${item.flipX ? -1 : 1} ${item.flipY ? -1 : 1})"` : "";
  const text = layoutShapeText(item, item.w, item.h);
  const words = text
    ? text.lines
        .filter((l) => l.text)
        .map((l) => `<text x="${num(l.x)}" y="${num(l.y + text.lineHeight / 2)}" dy="0.35em" font-size="${num(text.size)}"${text.bold ? ' font-weight="bold"' : ""}${text.italic ? ' font-style="italic"' : ""} fill="${esc(text.color)}" stroke="none">${esc(l.text)}</text>`)
        .join("")
    : "";
  const place = `translate(${num(item.x + item.w / 2)} ${num(item.y + item.h / 2)})${item.rotation ? ` rotate(${num(item.rotation)})` : ""} translate(${num(-item.w / 2)} ${num(-item.h / 2)})`;
  return `<g transform="${place}" font-family="${SHAPE_FONT}" data-shape="${esc(item.id)}" data-kind="${esc(item.shape)}"><g${flip}>${parts}</g>${words}</g>`;
}

export const shapesSvg = (items: readonly ShapeItem[] | undefined) => (items ?? []).map(shapeSvg).join("");

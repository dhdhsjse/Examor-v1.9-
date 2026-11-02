// The picture of the Probability Studio's sheet for the page (an image block's `src`): the same scene as the canvas, cropped to
// what is drawn, with a margin; the drawings of the floating tool bar drawn as ink. Pure function, unit-tested.
import { inkModel, shapeToInk, strokeSeed } from "@/app/_lib/ink/engine";
import { shapeSvg, type ShapeItem } from "@/app/_lib/shapes";
import { contentBounds } from "./ops";
import { FONT, INK, drawItem, type Circ, type Prim } from "./scene";
import type { ProbaConfig } from "./types";

export const PICTURE_MARGIN = 14;
const num = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pts = (p: number[]) => Array.from({ length: p.length / 2 }, (_, i) => `${num(p[2 * i])},${num(p[2 * i + 1])}`).join(" ");
const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "");

/** The svg of one prim; `defs` gathers the clip paths and masks of the shaded regions. */
function primSvg(p: Prim, defs: string[]): string {
  switch (p.k) {
    case "line": {
      const tag = p.closed ? "polygon" : "polyline";
      return `<${tag} points="${pts(p.pts)}" fill="${p.fill ?? "none"}" stroke="${p.color ?? INK}" stroke-width="${num(p.w)}"${p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case "circle":
      return `<circle cx="${num(p.cx)}" cy="${num(p.cy)}" r="${num(p.r)}" fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${num(p.w ?? 1.5)}"` : ""}/>`;
    case "rect":
      return `<rect x="${num(p.x)}" y="${num(p.y)}" width="${num(p.w)}" height="${num(p.h)}"${p.radius ? ` rx="${p.radius}"` : ""} fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${num(p.sw ?? 1.5)}"` : ""}/>`;
    case "path":
      return `<path d="${p.d}" fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${num(p.w ?? 1.5)}" stroke-linejoin="round" stroke-linecap="round"` : ""}/>`;
    case "text":
      return `<text x="${num(p.x)}" y="${num(p.y)}" dy="0.35em" text-anchor="${p.anchor}" font-size="${num(p.size)}"${p.bold ? ' font-weight="bold"' : ""}${p.italic ? ' font-style="italic"' : ""} fill="${p.color ?? INK}">${esc(p.text)}</text>`;
    case "region": {
      // inside every circle of `inside` (clip paths, one in the other), outside every one of `outside` (a mask with them in black)
      const id = safeId(p.id);
      const circle = (c: Circ, fill = "") => `<circle cx="${num(c.cx)}" cy="${num(c.cy)}" r="${num(c.r)}"${fill}/>`;
      p.inside.forEach((c, i) => defs.push(`<clipPath id="c-${id}-${i}">${circle(c)}</clipPath>`));
      if (p.outside.length)
        defs.push(`<mask id="m-${id}" maskUnits="userSpaceOnUse" x="${num(p.frame.x)}" y="${num(p.frame.y)}" width="${num(p.frame.w)}" height="${num(p.frame.h)}"><rect x="${num(p.frame.x)}" y="${num(p.frame.y)}" width="${num(p.frame.w)}" height="${num(p.frame.h)}" fill="#fff"/>${p.outside.map((c) => circle(c, ' fill="#000"')).join("")}</mask>`);
      let body = `<rect x="${num(p.frame.x)}" y="${num(p.frame.y)}" width="${num(p.frame.w)}" height="${num(p.frame.h)}" fill="${p.fill}"${p.outside.length ? ` mask="url(#m-${id})"` : ""}/>`;
      for (let i = p.inside.length - 1; i >= 0; i--) body = `<g clip-path="url(#c-${id}-${i})">${body}</g>`;
      return body;
    }
  }
}

/** A drawing of the floating tool bar's brush, pencil or highlighter, as the page draws it; any other shape as a shape. */
function drawnShapeSvg(item: ShapeItem): string {
  if (!(item.ink && item.shape === "freehand")) return shapeSvg(item);
  const points = shapeToInk(item.adj, item.pressure, item.w, item.h);
  const model = inkModel(item.ink, points, item.strokeWidth ?? 3, strokeSeed(item.adj));
  if (!model.body) return "";
  const color = esc(item.stroke ?? "#111111");
  const look = item.ink === "highlighter" ? ` fill-opacity="0.55" style="mix-blend-mode:multiply"` : item.ink === "pencil" ? ` fill-opacity="0.92"` : "";
  const place = `translate(${num(item.x + item.w / 2)} ${num(item.y + item.h / 2)})${item.rotation ? ` rotate(${num(item.rotation)})` : ""} translate(${num(-item.w / 2)} ${num(-item.h / 2)})`;
  const flip = item.flipX || item.flipY ? ` transform="translate(${item.flipX ? num(item.w) : 0} ${item.flipY ? num(item.h) : 0}) scale(${item.flipX ? -1 : 1} ${item.flipY ? -1 : 1})"` : "";
  return `<g transform="${place}"><g${flip}><path d="${model.body}" fill="${color}"${look}/></g></g>`;
}

export type ProbaImage = { svg: string; width: number; height: number };

/** The picture of the sheet (null for an empty one). Its size is that of what is drawn plus a margin. */
export function renderProbaSvg(config: ProbaConfig): ProbaImage | null {
  const box = contentBounds(config);
  if (!box) return null;
  const x0 = Math.floor(box.x - PICTURE_MARGIN);
  const y0 = Math.floor(box.y - PICTURE_MARGIN);
  const width = Math.ceil(box.x + box.w + PICTURE_MARGIN) - x0;
  const height = Math.ceil(box.y + box.h + PICTURE_MARGIN) - y0;
  const defs: string[] = [];
  const items = config.items.map((it) => `<g data-item="${esc(it.id)}" data-kind="${it.kind}">${drawItem(it).prims.map((p) => primSvg(p, defs)).join("")}</g>`).join("");
  const shapes = (config.shapes ?? []).map(drawnShapeSvg).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}<g transform="translate(${-x0} ${-y0})">${items}${shapes}</g></svg>`;
  return { svg, width, height };
}

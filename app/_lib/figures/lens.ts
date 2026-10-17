import { arrowDefs, bool, clamp, dot, ink, label, line, num, str, svg, type Pt } from "./svg";
import type { FigureDef } from "./types";

// A thin lens on its optical axis, with an object, its image and the two classic rays.
// Distances are in pixels; the image follows the lens formula 1/OA' − 1/OA = 1/f.
export const lensFigure: FigureDef = {
  id: "lens",
  name: "Lens",
  params: [
    {
      key: "type",
      label: "Lens",
      kind: "select",
      options: [
        { value: "converging", label: "Converging" },
        { value: "diverging", label: "Diverging" },
      ],
    },
    { key: "focal", label: "Focal length", kind: "number", min: 30, max: 140, unit: "px", row: "d" },
    { key: "object", label: "Object distance", kind: "number", min: 20, max: 260, unit: "px", row: "d" },
    { key: "height", label: "Object height", kind: "number", min: 15, max: 70, unit: "px" },
    { key: "showObject", label: "Object AB", kind: "bool", row: "show" },
    { key: "rays", label: "Rays", kind: "bool", row: "show" },
    { key: "showImage", label: "Image A'B'", kind: "bool", row: "show" },
  ],
  defaults: () => ({ type: "converging", focal: 70, object: 160, height: 40, showObject: true, rays: false, showImage: false }),
  build: (p) => {
    const color = ink(p);
    const conv = str(p, "type", "converging") !== "diverging";
    const f = clamp(num(p, "focal", 70), 30, 140) * (conv ? 1 : -1);
    const d = clamp(num(p, "object", 160), 20, 260);
    const h = clamp(num(p, "height", 40), 15, 70);
    const showObj = bool(p, "showObject");
    // Image: v = f·d / (d − f) (v < 0: virtual, on the object's side). None when d = f.
    const v = Math.abs(d - f) < 1 ? null : (f * d) / (d - f);
    const hi = v === null ? null : (-v * h) / d;
    const imageOk = v !== null && hi !== null && Math.abs(v) < 420 && Math.abs(hi) < 150;
    const drawImage = showObj && bool(p, "showImage") && imageOk;

    const right = Math.max(Math.abs(f), drawImage && v! > 0 ? v! : 0, 120) + 50;
    const left = Math.max(d, Math.abs(f), drawImage && v! < 0 ? -v! : 0) + 40;
    const up = Math.max(80, h + 20, drawImage && hi! > 0 ? hi! + 20 : 0);
    const down = Math.max(80, drawImage && hi! < 0 ? -hi! + 20 : 0);
    const cx = left;
    const cy = up;
    const P = (x: number, y: number): Pt => [cx + x, cy - y];
    const W = left + right;
    const H = up + down;
    const lensH = 70;

    let body = arrowDefs(color) + arrowDefs("#2563eb", "o") + arrowDefs("#dc2626", "i");
    body += line([6, cy], [W - 6, cy], 'stroke-width="1.2"');
    // The lens: ↕ for converging, inverted heads for diverging.
    body += line(P(0, lensH), P(0, -lensH), 'stroke-width="2.4"');
    const head = (y: number, outward: boolean) => {
      // Wings below a tip that points up, above one that points down.
      const s = outward === y > 0 ? 1 : -1;
      return `<path d="M${cx - 8} ${cy - y + s * 9}L${cx} ${cy - y}L${cx + 8} ${cy - y + s * 9}" stroke-width="2.2"/>`;
    };
    body += head(lensH, conv) + head(-lensH, conv);
    // Focal points (F on the object side for a converging lens).
    for (const [x, name] of [
      [-Math.abs(f), conv ? "F" : "F'"],
      [Math.abs(f), conv ? "F'" : "F"],
    ] as const) {
      body += line(P(x, 4), P(x, -4), 'stroke-width="1.6"') + label(P(x, -16), name, color, 13, { bold: true });
    }
    body += dot(P(0, 0), 2.4, color) + label(P(10, -14), "O", color, 13, { bold: true });

    if (showObj) {
      body += line(P(-d, 0), P(-d, h), 'stroke="#2563eb" stroke-width="2.4" marker-end="url(#o)"');
      body += label(P(-d, -14), "A", "#2563eb", 13, { bold: true }) + label(P(-d - 12, h), "B", "#2563eb", 13, { bold: true });
    }
    if (showObj && bool(p, "rays")) {
      const ray = 'stroke="#f59e0b" stroke-width="1.5"';
      const dashed = 'stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="5 4"';
      const endX = right - 12;
      // 1. Parallel to the axis, then through F' (or as if coming from F').
      const s1 = -h / f; // slope after the lens
      body += line(P(-d, h), P(0, h), ray) + line(P(0, h), P(endX, h + s1 * endX), ray);
      // 2. Through the center, not deviated.
      const s2 = -h / d;
      body += line(P(-d, h), P(endX, h + s2 * endX), ray);
      // Virtual image: the rays seem to come from it.
      if (imageOk && v! < 0) body += line(P(0, h), P(v!, hi!), dashed) + line(P(0, 0), P(v!, hi!), dashed);
    }
    if (drawImage) {
      const style = v! > 0 ? 'stroke="#dc2626" stroke-width="2.4" marker-end="url(#i)"' : 'stroke="#dc2626" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#i)"';
      body += line(P(v!, 0), P(v!, hi!), style);
      body += label(P(v!, hi! > 0 ? -14 : 14), "A'", "#dc2626", 13, { bold: true }) + label(P(v! + 14, hi!), "B'", "#dc2626", 13, { bold: true });
    }
    return svg(W, H, body, color);
  },
};

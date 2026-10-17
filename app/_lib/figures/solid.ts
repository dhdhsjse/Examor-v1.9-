import { add, bool, clamp, cornerNames, ink, label, line, num, r1, str, svg, type Pt } from "./svg";
import type { FigureDef, Params } from "./types";

const named = (p: Params) => ["cube", "cuboid", "pyramid"].includes(String(p.kind));

// Space shapes in oblique view; the hidden edges can be dashed.
export const solidFigure: FigureDef = {
  id: "solid",
  name: "Solid",
  params: [
    {
      key: "kind",
      label: "Shape",
      kind: "select",
      options: [
        { value: "cube", label: "Cube" },
        { value: "cuboid", label: "Cuboid" },
        { value: "pyramid", label: "Pyramid" },
        { value: "cylinder", label: "Cylinder" },
        { value: "cone", label: "Cone" },
        { value: "sphere", label: "Sphere" },
      ],
    },
    { key: "w", label: "Width", kind: "number", min: 30, max: 200, row: "size", when: (p) => p.kind !== "cube" && p.kind !== "sphere" },
    { key: "h", label: "Height", kind: "number", min: 30, max: 200, row: "size", when: (p) => p.kind !== "cube" && p.kind !== "sphere" },
    { key: "d", label: "Depth", kind: "number", min: 20, max: 160, row: "size", when: (p) => p.kind === "cuboid" || p.kind === "pyramid" },
    { key: "hidden", label: "Dashed hidden edges", kind: "bool" },
    { key: "names", label: "Corner names", kind: "text", placeholder: "ABCDEFGH", when: named },
  ],
  defaults: () => ({ kind: "cube", w: 120, h: 90, d: 80, hidden: true, names: "ABCDEFGH" }),
  // The usual names follow the shape (a pyramid's top is S).
  normalize: (p, changed) => {
    if (changed !== "kind") return p;
    if (p.kind === "pyramid" && p.names === "ABCDEFGH") return { ...p, names: "ABCDS" };
    if ((p.kind === "cube" || p.kind === "cuboid") && p.names === "ABCDS") return { ...p, names: "ABCDEFGH" };
    return p;
  },
  build: (p) => {
    const color = ink(p);
    const kind = str(p, "kind", "cube");
    const dash = bool(p, "hidden") ? 'stroke-dasharray="6 5" stroke-width="1.5"' : 'stroke="none"';
    let w = clamp(num(p, "w", 120), 30, 200);
    let h = clamp(num(p, "h", 90), 30, 200);
    let d = clamp(num(p, "d", 80), 20, 160);
    if (kind === "cube") [w, h, d] = [110, 110, 110];
    // Depth goes up and to the right, at half its length.
    const o: Pt = [d * 0.5 * Math.cos(Math.PI / 6), -d * 0.5 * Math.sin(Math.PI / 6)];
    const pad = 26;
    let body = "";

    if (kind === "cube" || kind === "cuboid") {
      const A: Pt = [pad, pad - o[1] + h];
      const B = add(A, [w, 0]);
      const C = add(B, [0, -h]);
      const D = add(A, [0, -h]);
      const [E, F, G, H] = [A, B, C, D].map((q) => add(q, o));
      const names = cornerNames(str(p, "names", "ABCDEFGH"), 8);
      body += `<path d="M${r1(A[0])} ${r1(A[1])}H${r1(B[0])}V${r1(C[1])}H${r1(D[0])}Z"/>`;
      body += line(B, F) + line(C, G) + line(D, H) + line(F, G) + line(G, H);
      body += line(A, E, dash) + line(E, F, dash) + line(E, H, dash);
      const spots: [Pt, Pt][] = [[A, [-12, 12]], [B, [10, 12]], [C, [12, 4]], [D, [-12, -2]], [E, [-12, 8]], [F, [12, 6]], [G, [10, -8]], [H, [-10, -8]]];
      spots.forEach(([q, off], i) => (body += label(add(q, off), names[i], color, 14, { bold: true })));
      return svg(pad * 2 + w + o[0], pad * 2 + h - o[1], body, color);
    }
    if (kind === "pyramid") {
      const A: Pt = [pad, pad + h - o[1]];
      const B = add(A, [w, 0]);
      const C = add(B, o);
      const D = add(A, o);
      const S: Pt = [(A[0] + C[0]) / 2, pad];
      const names = cornerNames(str(p, "names", "ABCDS"), 5);
      body += line(A, B) + line(B, C) + line(S, A) + line(S, B) + line(S, C);
      body += line(A, D, dash) + line(D, C, dash) + line(S, D, dash);
      const spots: [Pt, Pt][] = [[A, [-12, 10]], [B, [10, 10]], [C, [12, 0]], [D, [-12, -4]], [S, [0, -12]]];
      // The 5th name is the top (S by default).
      const top = names[4] || "S";
      spots.forEach(([q, off], i) => (body += label(add(q, off), i === 4 ? top : names[i], color, 14, { bold: true })));
      return svg(pad * 2 + w + o[0], pad * 2 + h - o[1], body, color);
    }
    // Round solids: ellipses for the circles seen at an angle.
    const rx = kind === "sphere" ? 80 : w / 2;
    const ry = rx * 0.3;
    const cx = pad + rx;
    const half = (y: number, front: boolean) => `<path d="M${r1(cx - rx)} ${r1(y)}A${r1(rx)} ${r1(ry)} 0 0 ${front ? 0 : 1} ${r1(cx + rx)} ${r1(y)}" ${front ? "" : dash}/>`;
    if (kind === "sphere") {
      const cy = pad + rx;
      body += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${rx}"/>` + half(cy, true) + half(cy, false);
      return svg(pad * 2 + rx * 2, pad * 2 + rx * 2, body, color);
    }
    const top = pad + ry;
    const bottom = top + h;
    if (kind === "cylinder") {
      body += `<ellipse cx="${r1(cx)}" cy="${r1(top)}" rx="${r1(rx)}" ry="${r1(ry)}"/>`;
      body += line([cx - rx, top], [cx - rx, bottom]) + line([cx + rx, top], [cx + rx, bottom]);
    } else {
      body += line([cx, pad], [cx - rx, bottom]) + line([cx, pad], [cx + rx, bottom]);
    }
    body += half(bottom, true) + half(bottom, false);
    return svg(pad * 2 + rx * 2, bottom + ry + pad, body, color);
  },
};

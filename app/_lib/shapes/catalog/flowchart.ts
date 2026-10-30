// Flowchart symbols (process, decision, data, document, terminator…). Fixed shapes: the flowchart reads by its shapes, so they
// have no handles; the drawing fits whatever box is given.
import { A, C, H, L, M, Q, V, Z, ellipsePath, polygon, rectPath, roundedRect } from "../path";
import type { ShapeDef, ShapePart } from "../types";

const BASE = { category: "Flowchart" } as const;
const fill = (d: string): ShapePart[] => [{ d, paint: "fill" }];
const line = (d: string): ShapePart => ({ d, paint: "line" });
const ELLIPSE_INSET = [0.146, 0.146, 0.146, 0.146] as const;

// A document with a wavy bottom edge, in the box (x, y, ww, hh).
function docPath(x: number, y: number, ww: number, hh: number): string {
  const X = (u: number) => x + (u / 100) * ww;
  const Y = (v: number) => y + (v / 100) * hh;
  return M(X(0), Y(0)) + L(X(100), Y(0)) + L(X(100), Y(85)) + C(X(75), Y(70), X(62), Y(70), X(50), Y(85)) + C(X(38), Y(100), X(25), Y(100), X(0), Y(85)) + Z;
}

export const FLOWCHART: ShapeDef[] = [
  { ...BASE, id: "flowProcess", label: "Process", parts: (w, h) => fill(rectPath(0, 0, w, h)) },
  { ...BASE, id: "flowAlternateProcess", label: "Alternate process", parts: (w, h) => fill(roundedRect(w, h, Math.min(w, h) * 0.1667)) },
  {
    ...BASE,
    id: "flowDecision",
    label: "Decision",
    textInset: [0.25, 0.25, 0.25, 0.25],
    parts: (w, h) =>
      fill(
        polygon([
          [w / 2, 0],
          [w, h / 2],
          [w / 2, h],
          [0, h / 2],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowData",
    label: "Data",
    textInset: [0.15, 0, 0.15, 0],
    parts: (w, h) =>
      fill(
        polygon([
          [w * 0.2, 0],
          [w, 0],
          [w * 0.8, h],
          [0, h],
        ]),
      ),
  },
  { ...BASE, id: "flowPredefinedProcess", label: "Predefined process", textInset: [0.15, 0, 0.15, 0], parts: (w, h) => [{ d: rectPath(0, 0, w, h), paint: "fill" }, line(M(w * 0.125, 0) + V(h) + M(w * 0.875, 0) + V(h))] },
  { ...BASE, id: "flowInternalStorage", label: "Internal storage", textInset: [0.15, 0.15, 0, 0], parts: (w, h) => [{ d: rectPath(0, 0, w, h), paint: "fill" }, line(M(w * 0.125, 0) + V(h) + M(0, h * 0.125) + H(w))] },
  { ...BASE, id: "flowDocument", label: "Document", textInset: [0, 0, 0, 0.18], parts: (w, h) => fill(docPath(0, 0, w, h)) },
  {
    ...BASE,
    id: "flowMultiDocument",
    label: "Multidocument",
    textInset: [0, 0.15, 0.12, 0.2],
    parts: (w, h) => {
      const m = Math.min(w, h) * 0.08;
      return [
        { d: docPath(2 * m, 0, w - 2 * m, h - 2 * m), paint: "fill" },
        { d: docPath(m, m, w - 2 * m, h - 2 * m), paint: "fill" },
        { d: docPath(0, 2 * m, w - 2 * m, h - 2 * m), paint: "fill" },
      ];
    },
  },
  { ...BASE, id: "flowTerminator", label: "Terminator", textInset: [0.1, 0, 0.1, 0], parts: (w, h) => fill(roundedRect(w, h, h / 2)) },
  {
    ...BASE,
    id: "flowPreparation",
    label: "Preparation",
    textInset: [0.15, 0, 0.15, 0],
    parts: (w, h) =>
      fill(
        polygon([
          [w * 0.2, 0],
          [w * 0.8, 0],
          [w, h / 2],
          [w * 0.8, h],
          [w * 0.2, h],
          [0, h / 2],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowManualInput",
    label: "Manual input",
    textInset: [0, 0.2, 0, 0],
    parts: (w, h) =>
      fill(
        polygon([
          [0, h * 0.2],
          [w, 0],
          [w, h],
          [0, h],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowManualOperation",
    label: "Manual operation",
    textInset: [0.15, 0, 0.15, 0],
    parts: (w, h) =>
      fill(
        polygon([
          [0, 0],
          [w, 0],
          [w * 0.8, h],
          [w * 0.2, h],
        ]),
      ),
  },
  { ...BASE, id: "flowConnector", label: "Connector", textInset: ELLIPSE_INSET, size: [70, 70], parts: (w, h) => fill(ellipsePath(w / 2, h / 2, w / 2, h / 2)) },
  {
    ...BASE,
    id: "flowOffPageConnector",
    label: "Off-page connector",
    textInset: [0, 0, 0, 0.2],
    parts: (w, h) =>
      fill(
        polygon([
          [0, 0],
          [w, 0],
          [w, h * 0.8],
          [w / 2, h],
          [0, h * 0.8],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowCard",
    label: "Card",
    parts: (w, h) => {
      const c = Math.min(w, h) * 0.2;
      return fill(
        polygon([
          [c, 0],
          [w, 0],
          [w, h],
          [0, h],
          [0, c],
        ]),
      );
    },
  },
  {
    ...BASE,
    id: "flowPunchedTape",
    label: "Punched tape",
    textInset: [0, 0.2, 0, 0.2],
    parts: (w, h) => {
      const X = (u: number) => (u / 100) * w;
      const Y = (v: number) => (v / 100) * h;
      return fill(M(0, Y(12)) + C(X(20), Y(0), X(30), Y(0), X(50), Y(12)) + C(X(70), Y(26), X(80), Y(26), X(100), Y(12)) + V(Y(88)) + C(X(80), Y(100), X(70), Y(100), X(50), Y(88)) + C(X(30), Y(74), X(20), Y(74), 0, Y(88)) + Z);
    },
  },
  {
    ...BASE,
    id: "flowSummingJunction",
    label: "Summing junction",
    size: [70, 70],
    textInset: ELLIPSE_INSET,
    parts: (w, h) => {
      const k = Math.SQRT1_2;
      const [cx, cy] = [w / 2, h / 2];
      return [
        { d: ellipsePath(cx, cy, cx, cy), paint: "fill" },
        line(M(cx - cx * k, cy - cy * k) + L(cx + cx * k, cy + cy * k) + M(cx + cx * k, cy - cy * k) + L(cx - cx * k, cy + cy * k)),
      ];
    },
  },
  {
    ...BASE,
    id: "flowOr",
    label: "Or",
    size: [70, 70],
    textInset: ELLIPSE_INSET,
    parts: (w, h) => [{ d: ellipsePath(w / 2, h / 2, w / 2, h / 2), paint: "fill" }, line(M(w / 2, 0) + V(h) + M(0, h / 2) + H(w))],
  },
  {
    ...BASE,
    id: "flowCollate",
    label: "Collate",
    size: [80, 100],
    textInset: [0.3, 0.2, 0.3, 0.2],
    parts: (w, h) =>
      fill(
        polygon([
          [0, 0],
          [w, 0],
          [0, h],
          [w, h],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowSort",
    label: "Sort",
    textInset: [0.25, 0.25, 0.25, 0.25],
    parts: (w, h) => [
      {
        d: polygon([
          [w / 2, 0],
          [w, h / 2],
          [w / 2, h],
          [0, h / 2],
        ]),
        paint: "fill",
      },
      line(M(0, h / 2) + H(w)),
    ],
  },
  {
    ...BASE,
    id: "flowExtract",
    label: "Extract",
    textInset: [0.25, 0.5, 0.25, 0],
    parts: (w, h) =>
      fill(
        polygon([
          [w / 2, 0],
          [w, h],
          [0, h],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowMerge",
    label: "Merge",
    textInset: [0.25, 0, 0.25, 0.5],
    parts: (w, h) =>
      fill(
        polygon([
          [0, 0],
          [w, 0],
          [w / 2, h],
        ]),
      ),
  },
  {
    ...BASE,
    id: "flowStoredData",
    label: "Stored data",
    textInset: [0.15, 0, 0.1, 0],
    parts: (w, h) => fill(M(w * 0.12, 0) + L(w, 0) + Q(w * 0.88, h / 2, w, h) + L(w * 0.12, h) + Q(0, h / 2, w * 0.12, 0) + Z),
  },
  { ...BASE, id: "flowDelay", label: "Delay", textInset: [0, 0, 0.15, 0], parts: (w, h) => fill(M(0, 0) + H(w / 2) + A(w / 2, h / 2, 0, 1, w / 2, h) + H(0) + Z) },
  { ...BASE, id: "flowSequentialData", label: "Sequential access storage", size: [80, 80], textInset: ELLIPSE_INSET, parts: (w, h) => [{ d: ellipsePath(w / 2, h / 2, w / 2, h / 2), paint: "fill" }, line(M(w / 2, h) + H(w))] },
  {
    ...BASE,
    id: "flowMagneticDisk",
    label: "Magnetic disk",
    textInset: [0, 0.3, 0, 0],
    parts: (w, h) => {
      const e = Math.min(h * 0.17, w / 2);
      return [
        { d: M(0, e) + A(w / 2, e, 0, 1, w, e) + V(h - e) + A(w / 2, e, 0, 1, 0, h - e) + Z, paint: "fill" },
        { d: M(0, e) + A(w / 2, e, 0, 0, w, e) + A(w / 2, e, 0, 0, 0, e) + Z, paint: "light" },
      ];
    },
  },
  {
    ...BASE,
    id: "flowDirectAccessStorage",
    label: "Direct access storage",
    textInset: [0.1, 0, 0.25, 0],
    parts: (w, h) => {
      const e = Math.min(w * 0.17, h);
      return [
        { d: M(e, 0) + H(w - e) + A(e, h / 2, 0, 1, w - e, h) + H(e) + A(e, h / 2, 0, 1, e, 0) + Z, paint: "fill" },
        { d: M(w - e, 0) + A(e, h / 2, 0, 0, w - e, h) + A(e, h / 2, 0, 0, w - e, 0) + Z, paint: "light" },
      ];
    },
  },
  {
    ...BASE,
    id: "flowDisplay",
    label: "Display",
    textInset: [0.2, 0, 0.15, 0],
    parts: (w, h) => fill(M(0, h / 2) + L(w * 0.2, 0) + H(w * 0.8) + A(w * 0.2, h / 2, 0, 1, w * 0.8, h) + H(w * 0.2) + Z),
  },
];

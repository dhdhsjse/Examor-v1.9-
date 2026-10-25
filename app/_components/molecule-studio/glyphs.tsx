"use client";

import { chemSegments, type ChemSegment } from "@/app/_lib/chemistry/chemText";
import { bondDrawing } from "@/app/_lib/chemistry/bondGeometry";
import type { BondType } from "@/app/_lib/chemistry/types";

// Small drawings and texts shared by the toolbar and the Properties panel.

// A bond as it is drawn on the paper (the same geometry), small: between two imaginary atoms 48 apart, so that the
// 12 the drawing keeps clear at each end leave the middle 24.
export function BondGlyph({ type }: { type: BondType }) {
  const { lines, polygon, parts } = bondDrawing({ x: -9, y: 8 }, { x: 39, y: 8 }, type);
  const pairs = (p: number[]) => Array.from({ length: p.length / 2 }, (_, i) => p[2 * i] + "," + p[2 * i + 1]).join(" "); // x,y x,y…
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true" fill="none" stroke="currentColor">
      {polygon && <polygon points={pairs(polygon)} fill="currentColor" strokeWidth="0.5" />}
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth="1.8" strokeLinecap="round" />
      ))}
      {parts?.map((p, i) =>
        p.kind === "line" ? (
          <line key={i} x1={p.seg.x1} y1={p.seg.y1} x2={p.seg.x2} y2={p.seg.y2} strokeWidth={p.width ? p.width * 1.1 : 1.8} strokeDasharray={p.dash?.join(" ")} strokeLinecap={p.round ? "round" : "butt"} />
        ) : p.kind === "outline" ? (
          <polygon key={i} points={pairs(p.points)} strokeWidth="1.5" strokeLinejoin="round" />
        ) : p.kind === "polyline" ? (
          <polyline key={i} points={pairs(p.points)} strokeWidth="1.6" strokeLinejoin="round" />
        ) : (
          <polygon key={i} points={pairs(p.points)} fill="currentColor" strokeWidth="0.5" />
        ),
      )}
    </svg>
  );
}

/** A formula or a group written with its subscripts and charge: pass the text ("COOH") or the pieces (formulaSegments). */
export function ChemLabel({ text, segments }: { text?: string; segments?: ChemSegment[] }) {
  const pieces = segments ?? chemSegments(text ?? "");
  return (
    <>
      {pieces.map((seg, i) => (seg.kind === "sub" ? <sub key={i}>{seg.text}</sub> : seg.kind === "sup" ? <sup key={i}>{seg.text}</sup> : <span key={i}>{seg.text}</span>))}
    </>
  );
}

"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { emptySelection, pick, type Kind, type Selection } from "@/app/_molecule/edit/select";

type Pos = Record<string, { x: number; y: number }>;

interface Props {
  svg: string;
  selection: Selection;
  onSelection: (s: Selection) => void;
  zoom: number;
  editable: boolean; // false: a drawing to look at (formulas)
  movable: boolean; // atoms can be dragged (not on a drawing with its own fixed layout, like Cram)
  unit: number; // px of one bond length in the drawing
  positions: () => Pos; // where every atom is now, in bond lengths
  onMove: (to: Pos) => void;
}

const SELECTABLE = "[data-atom-id],[data-bond-id],[data-lp-id]";

type Drag =
  | { kind: "move"; startX: number; startY: number; origin: Pos; moved: boolean }
  | { kind: "band"; startX: number; startY: number; additive: boolean; base: Selection };

function hitOf(el: Element | null): { kind: Kind; id: string } | null {
  const t = el?.closest(SELECTABLE);
  if (!t) return null;
  const atom = t.getAttribute("data-atom-id");
  if (atom) return { kind: "atoms", id: atom };
  const bond = t.getAttribute("data-bond-id");
  if (bond) return { kind: "bonds", id: bond };
  return { kind: "lonePairs", id: t.getAttribute("data-lp-id") ?? "" };
}

// The drawing as inline SVG, with click / shift-click / rubber-band selection and atom dragging. Every drawn
// element carries data-atom-id / data-bond-id / data-lp-id, which is how a click finds its model element.
export default function EditCanvas({ svg, selection, onSelection, zoom, editable, movable, unit, positions, onMove }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // The selected elements are drawn in the accent color (only here: the exported drawing is plain).
  const css = useMemo(() => {
    const q = (s: string) => s.replace(/"/g, "");
    const R = "[data-testid=\"edit-canvas\"] "; // only this canvas: the previews show the same ids
    return [
      ...selection.atoms.map((id) => `${R}[data-atom-id="${q(id)}"]>:is(rect,circle):first-child{fill:rgba(79,70,229,.16);stroke:#4f46e5;stroke-width:1.2}${R}[data-atom-id="${q(id)}"] text{fill:#4f46e5}`),
      ...selection.bonds.map((id) => `${R}[data-bond-id="${q(id)}"] line:not([data-hit]){stroke:#4f46e5;stroke-width:2.8}`),
      ...selection.lonePairs.map((id) => `${R}[data-lp-id="${q(id)}"] .lp{fill:#4f46e5;stroke:#4f46e5}${R}[data-lp-id="${q(id)}"]>circle:first-child{fill:rgba(79,70,229,.16)}`),
    ].join("");
  }, [selection]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!editable || e.button !== 0) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const hit = hitOf(e.target as Element);
    box.current?.setPointerCapture(e.pointerId);
    if (!hit) {
      drag.current = { kind: "band", startX: e.clientX, startY: e.clientY, additive, base: selection };
      return;
    }
    const next = additive || !selection[hit.kind].includes(hit.id) ? pick(selection, hit.kind, hit.id, additive) : selection;
    onSelection(next);
    if (movable && hit.kind === "atoms" && next.atoms.includes(hit.id)) {
      const all = positions();
      const origin: Pos = {};
      for (const id of next.atoms) if (all[id]) origin[id] = all[id];
      drag.current = { kind: "move", startX: e.clientX, startY: e.clientY, origin, moved: false };
    }
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "band") {
      const r = box.current?.getBoundingClientRect();
      if (r) setBand({ x0: d.startX - r.left, y0: d.startY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top });
      return;
    }
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const to: Pos = {};
    for (const [id, p] of Object.entries(d.origin)) to[id] = { x: p.x + dx / zoom / unit, y: p.y + dy / zoom / unit };
    onMove(to);
  };

  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (box.current?.hasPointerCapture(e.pointerId)) box.current.releasePointerCapture(e.pointerId);
    if (!d || d.kind !== "band") return;
    setBand(null);
    const x0 = Math.min(d.startX, e.clientX);
    const x1 = Math.max(d.startX, e.clientX);
    const y0 = Math.min(d.startY, e.clientY);
    const y1 = Math.max(d.startY, e.clientY);
    if (x1 - x0 < 4 && y1 - y0 < 4) {
      if (!d.additive) onSelection(emptySelection()); // a click on the empty page
      return;
    }
    const found: Selection = d.additive ? { atoms: [...d.base.atoms], bonds: [...d.base.bonds], lonePairs: [...d.base.lonePairs] } : emptySelection();
    box.current?.querySelectorAll(SELECTABLE).forEach((el) => {
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      if (cx < x0 || cx > x1 || cy < y0 || cy > y1) return;
      const hit = hitOf(el);
      if (hit && !found[hit.kind].includes(hit.id)) found[hit.kind].push(hit.id);
    });
    onSelection(found);
  };

  return (
    <div ref={box} data-testid="edit-canvas" className="relative grid h-full w-full touch-none place-items-center overflow-auto p-4" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <style>{`${editable ? '[data-testid="edit-canvas"] [data-atom-id],[data-testid="edit-canvas"] [data-bond-id],[data-testid="edit-canvas"] [data-lp-id]{cursor:pointer}' : ""}${css}`}</style>
      <div dir="ltr" className="rounded-md bg-white p-3 shadow-sm" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }} dangerouslySetInnerHTML={{ __html: svg }} />
      {band && (
        <div
          className="pointer-events-none absolute border border-accent bg-accent/10"
          style={{ left: Math.min(band.x0, band.x1), top: Math.min(band.y0, band.y1), width: Math.abs(band.x1 - band.x0), height: Math.abs(band.y1 - band.y0) }}
        />
      )}
    </div>
  );
}

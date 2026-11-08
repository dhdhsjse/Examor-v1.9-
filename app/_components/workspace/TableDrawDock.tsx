"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { DOCKED_HEIGHT_VAR } from "../math-keyboard/FloatingKeyboard";

/** Keep the table's tools near it and inside the visible worksheet, at screen size at every zoom: under the table, or above it when there is
 * no room under it (never over the table while it can be helped, the cells there are drawn on). */
export default function TableDrawDock({ scroll, stack, anchor, children }: {
  scroll: RefObject<HTMLDivElement | null>;
  stack: RefObject<HTMLDivElement | null>;
  anchor: { left: number; top: number; bottom: number } | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: 12, top: 12, above: false });
  const left = anchor?.left;
  const top0 = anchor?.top;
  const bottom = anchor?.bottom;
  useLayoutEffect(() => {
    const viewport = scroll.current;
    const pages = stack.current;
    const dock = ref.current;
    if (!viewport || !pages || !dock) return;
    const position = () => {
      const v = viewport.getBoundingClientRect();
      const p = pages.getBoundingClientRect();
      const w = dock.offsetWidth;
      const h = dock.offsetHeight;
      const keyboard = Number.parseFloat(getComputedStyle(viewport).getPropertyValue(DOCKED_HEIGHT_VAR)) || 0;
      const x = left === undefined ? (v.width - w) / 2 : p.left - v.left + left;
      const limit = v.height - keyboard - 64 - h;
      const below = bottom === undefined ? 12 : p.top - v.top + bottom + 8;
      const over = top0 === undefined ? 12 : p.top - v.top + top0 - 8 - h;
      const top = below <= limit ? Math.max(12, below) : over >= 12 ? Math.min(over, limit) : Math.max(12, Math.min(below, limit));
      const next = { left: Math.max(12, Math.min(x, v.width - w - 12)), top, above: top > v.height / 2 };
      setPlace((old) => old.left === next.left && old.top === next.top && old.above === next.above ? old : next);
    };
    position();
    viewport.addEventListener("scroll", position, { passive: true });
    const observer = new ResizeObserver(position);
    observer.observe(viewport);
    observer.observe(pages);
    observer.observe(dock);
    return () => { viewport.removeEventListener("scroll", position); observer.disconnect(); };
  }, [scroll, stack, left, top0, bottom]);
  return <div ref={ref} data-side={place.above ? "above" : "below"} className="group/table-dock absolute z-30 max-w-[calc(100%-24px)]" style={{ left: place.left, top: place.top }}>{children}</div>;
}

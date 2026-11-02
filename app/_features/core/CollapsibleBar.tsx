"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { PanelToggle } from "@/app/_components/PanelToggle";
import FeatureRenderer from "./FeatureRenderer";
import type { Bar, BarCollapse, Ctx } from "./types";

export const STRIP_WIDTH = 32; // a closed side bar

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// A side bar that slides closed to a thin strip. The frame narrows (the page area grows with it)
// while the content keeps its width and slides under the window edge. The edge tab and the strip
// reopen it; the open / closed choice is kept in Shell.hiddenBars.
// With `minWidth` / `maxWidth` its inner edge can be dragged to any width in between (kept in
// Shell.barWidths). Dragging far past the minimum closes it; a double-click on the edge resets it.
export default function CollapsibleBar({ bar, collapse, ctx, children }: { bar: Bar; collapse: BarCollapse; ctx: Ctx; children: ReactNode }) {
  const { t, dir, shell } = ctx;
  const open = !shell.hiddenBars.includes(bar.id);
  const side = bar.position === "left" ? "start" : "end";
  const resizable = collapse.minWidth !== undefined && collapse.maxWidth !== undefined;
  const min = collapse.minWidth ?? collapse.width;
  const max = collapse.maxWidth ?? collapse.width;
  const saved = clamp(shell.barWidths[bar.id] ?? collapse.width, min, max);
  // While dragging: the live width (only saved on release, so the page isn't redrawn on every move).
  const [drag, setDrag] = useState<{ width: number; closing: boolean } | null>(null);
  // The drag also lives in a ref: the release can come before the last move is drawn.
  const start = useRef<{ x: number; width: number; now: { width: number; closing: boolean } } | null>(null);
  const width = drag ? drag.width : saved;

  const hint = (text: string) => (collapse.hotkey ? `${t(text)} (${collapse.hotkey})` : t(text));
  const contentId = `${bar.id}-content`;
  const fade = "transition-opacity duration-200 ease-out motion-reduce:transition-none";
  // Moving the pointer toward the page widens the bar: left in LTR for a bar on the end side.
  const grow = (side === "end") === (dir === "ltr") ? -1 : 1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = { width: saved, closing: false };
    start.current = { x: e.clientX, width: saved, now };
    setDrag(now);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const raw = start.current.width + (e.clientX - start.current.x) * grow;
    start.current.now = { width: clamp(raw, min, max), closing: raw < min * 0.55 };
    setDrag(start.current.now);
  };
  const onPointerUp = () => {
    const end = start.current?.now;
    start.current = null;
    setDrag(null);
    if (!end) return;
    if (end.closing) shell.toggleBar(bar.id);
    else if (end.width !== saved) shell.setBarWidth(bar.id, Math.round(end.width));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    // The arrows move the edge on screen, like dragging it.
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    if (dx) {
      e.preventDefault();
      shell.setBarWidth(bar.id, clamp(saved + dx * grow, min, max));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      shell.setBarWidth(bar.id, e.key === "Home" ? min : max);
    }
  };

  const shown = open && !drag?.closing;
  return (
    <aside
      aria-label={t(collapse.label)}
      data-bar={bar.id}
      data-open={open}
      className={`group/edge relative shrink-0 ${drag ? "" : "transition-[width] duration-200 ease-out motion-reduce:transition-none"}`}
      style={{ width: shown ? width : STRIP_WIDTH }}
    >
      <div className={`absolute inset-0 overflow-hidden border-line bg-surface ${side === "start" ? "border-e" : "border-s"}`}>
        {/* Anchored to the inner edge, so it moves with it */}
        <div
          id={contentId}
          inert={!open}
          className={`absolute inset-y-0 ${side === "start" ? "end-0" : "start-0"} ${fade} ${shown ? "" : "pointer-events-none opacity-0"} ${bar.className ?? ""}`}
          style={{ width: width - 1 }}
        >
          {children}
        </div>

        {/* The strip of a closed bar: its shortcuts, and a click on the empty part reopens it */}
        <div
          inert={open}
          onClick={(e) => e.target === e.currentTarget && shell.toggleBar(bar.id)}
          title={hint(collapse.show)}
          className={`absolute inset-y-0 start-0 flex w-full cursor-pointer flex-col items-center gap-1 bg-surface pt-2 ${fade} ${open ? "pointer-events-none opacity-0" : ""}`}
        >
          {(collapse.strip ?? []).map((f) => (
            <FeatureRenderer key={f.id} feature={f} ctx={ctx} />
          ))}
        </div>
      </div>

      {/* The inner edge: drag to resize */}
      {resizable && open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("Resize {panel}", { panel: t(collapse.label) })}
          aria-controls={contentId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          title={t("Drag to resize · double-click to reset")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => shell.setBarWidth(bar.id, null)}
          onKeyDown={onKeyDown}
          className={`group absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none ${side === "start" ? "end-0 translate-x-1/2 rtl:-translate-x-1/2" : "start-0 -translate-x-1/2 rtl:translate-x-1/2"}`}
        >
          <span
            className={`pointer-events-none absolute inset-y-0 start-1/2 w-0.5 -translate-x-1/2 transition-colors rtl:translate-x-1/2 ${
              drag ? (drag.closing ? "bg-red-400" : "bg-indigo-500") : "bg-transparent group-hover:bg-indigo-300 group-focus-visible:bg-indigo-500"
            }`}
          />
        </div>
      )}

      <PanelToggle
        side={side}
        open={open}
        dir={dir}
        title={hint(open ? collapse.hide : collapse.show)}
        controls={contentId}
        onToggle={() => shell.toggleBar(bar.id)}
      />
    </aside>
  );
}

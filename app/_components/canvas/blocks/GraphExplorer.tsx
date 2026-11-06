"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Rect } from "react-konva";
import { zoomWindow } from "@/app/_lib/mathGraph";
import type { GraphBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import { GraphView } from "./GraphView";

type Win = Pick<GraphBlock, "xMin" | "xMax" | "yMin" | "yMax">;

const MIN_RANGE = 1e-3;
const MAX_RANGE = 2000;
const valid = (w: Win) => w.xMax - w.xMin > MIN_RANGE && w.yMax - w.yMin > MIN_RANGE && w.xMax - w.xMin < MAX_RANGE && w.yMax - w.yMin < MAX_RANGE;
// (a window kept to 4 decimals: the numbers in the panel stay readable)
const tidy = (w: Win): Win => ({ xMin: +w.xMin.toFixed(4), xMax: +w.xMax.toFixed(4), yMin: +w.yMin.toFixed(4), yMax: +w.yMax.toFixed(4) });

interface Props {
  b: GraphBlock;
  height: number;
  zoom: number; // of the page: screen pixels per page pixel
  onPatch: (patch: BlockPatch) => void;
}

// A graph on the page being looked around in (double-click it): drag to move its window, the wheel zooms about the mouse (Ctrl+wheel
// still zooms the page). The graph follows the mouse at once; the block gets the new window when the mouse is let go, or a moment after
// the wheel stops (one undo step). The block itself does not move meanwhile.
export function GraphExplorer({ b, height, zoom, onPatch }: Props) {
  const [view, setView] = useState<Win | null>(null); // the window shown while it is being changed (null = the block's)
  const shown: Win = view ?? b;
  const latest = useRef(shown);
  useEffect(() => {
    latest.current = shown;
  });
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
  }, []);

  const commit = (w: Win) => {
    onPatch(tidy(w));
    setView(null);
  };

  const startDrag = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const from = { ...shown };
    const x0 = e.evt.clientX;
    const y0 = e.evt.clientY;
    let moved = false;
    if (stage) stage.container().style.cursor = "grabbing";
    const move = (ev: MouseEvent) => {
      // screen pixels → page pixels → units of the graph
      const dx = ((ev.clientX - x0) / zoom / b.layout.width) * (from.xMax - from.xMin);
      const dy = ((ev.clientY - y0) / zoom / height) * (from.yMax - from.yMin);
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;
      moved = true;
      setView({ xMin: from.xMin - dx, xMax: from.xMax - dx, yMin: from.yMin + dy, yMax: from.yMax + dy });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (stage) stage.container().style.cursor = "grab";
      if (moved) commit(latest.current);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (e.evt.ctrlKey || e.evt.metaKey) return; // (the page's zoom)
    e.evt.preventDefault();
    e.cancelBubble = true;
    const p = e.target.getRelativePointerPosition();
    if (!p) return;
    const w = latest.current;
    const cx = w.xMin + (p.x / b.layout.width) * (w.xMax - w.xMin);
    const cy = w.yMax - (p.y / height) * (w.yMax - w.yMin);
    const next = zoomWindow(w, e.evt.deltaY > 0 ? 1.12 : 1 / 1.12, cx, cy);
    if (!valid(next)) return;
    setView(next);
    latest.current = next;
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => commit(latest.current), 350);
  };

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <>
      <GraphView b={{ ...b, ...shown }} />
      {/* the area that takes the mouse, with a frame that says the graph is being looked around in */}
      <Rect
        width={b.layout.width}
        height={height}
        fill="transparent"
        stroke="#6366f1"
        strokeWidth={1.5 / zoom}
        dash={[6 / zoom, 4 / zoom]}
        onMouseDown={startDrag}
        onWheel={onWheel}
        onMouseEnter={(e) => setCursor(e, "grab")}
        onMouseLeave={(e) => setCursor(e, "default")}
      />
    </>
  );
}

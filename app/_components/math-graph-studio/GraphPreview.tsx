"use client";

import { useEffect, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";
import { GraphView } from "@/app/_components/canvas/blocks/GraphView";
import { niceStep, tryCompile } from "@/app/_lib/graphMath";
import { colorOf, formatNum, nameOf, zoomWindow } from "@/app/_lib/mathGraph";
import type { GraphBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { StudioGraph } from "./mathGraphPreset";

const PADDING = 28;
const MAX_RANGE = 2000;
const MIN_RANGE = 1e-4;

type Window = Pick<StudioGraph, "xMin" | "xMax" | "yMin" | "yMax">;

interface Props {
  graph: StudioGraph;
  /** The function a click adds a tangent to, and what the readout under the pointer follows */
  selected: number;
  /** The next click on the graph adds a tangent to the selected function */
  tangentTool: boolean;
  onWindow: (w: Window) => void;
  onTangent: (x: number) => void;
}

const validWindow = (w: Window) => w.xMax - w.xMin > MIN_RANGE && w.yMax - w.yMin > MIN_RANGE && w.xMax - w.xMin < MAX_RANGE && w.yMax - w.yMin < MAX_RANGE;

// The graph as the page will draw it (the page's own GraphView), for looking at and moving about: drag to move the window, the wheel to
// zoom about the pointer, double-click to go back to the usual window. With the tangent tool in hand a click on the graph puts a tangent
// of the selected function at the x of the click. A readout says where the pointer is.
export default function GraphPreview({ graph, selected, tangentTool, onWindow, onTangent }: Props) {
  const t = useT();
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ x: number; y: number; from: Window; moved: boolean } | null>(null);
  const latest = useRef({ graph, onWindow });
  useEffect(() => {
    latest.current = { graph, onWindow };
  });

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRoom({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width: W, height: H } = graph;
  const scale = room.w > 0 ? Math.max(0.3, Math.min(1.6, (room.w - 2 * PADDING) / W, (room.h - 2 * PADDING) / H)) : 1;
  const block: GraphBlock = { ...graph, id: "preview", type: "graph", layout: { pageId: "p", x: 0, y: 0, width: W, height: H } };

  // pixels of the screen over the graph → the point of the graph
  const toGraph = (e: { clientX: number; clientY: number }, frame: DOMRect, w: Window = graph) => ({
    x: w.xMin + ((e.clientX - frame.left) / frame.width) * (w.xMax - w.xMin),
    y: w.yMax - ((e.clientY - frame.top) / frame.height) * (w.yMax - w.yMin),
  });

  // The wheel zooms (it must not scroll the page: a listener that may cancel it).
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { graph: g, onWindow: change } = latest.current;
      const r = el.getBoundingClientRect();
      const x = g.xMin + ((e.clientX - r.left) / r.width) * (g.xMax - g.xMin);
      const y = g.yMax - ((e.clientY - r.top) / r.height) * (g.yMax - g.yMin);
      const next = zoomWindow(g, e.deltaY > 0 ? 1.12 : 1 / 1.12, x, y);
      if (validWindow(next)) change(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fn = tryCompile(graph.functions[selected] ?? "").fn;
  const readout = at && (
    <span dir="ltr">
      x = {formatNum(at.x)} · y = {formatNum(at.y)}
      {fn && Number.isFinite(fn(at.x)) && (
        <>
          {" "}
          · <span style={{ color: colorOf(graph, selected) }}>{nameOf(selected)}(x) = {formatNum(fn(at.x))}</span>
        </>
      )}
    </span>
  );

  return (
    <div ref={area} dir="ltr" data-testid="graph-preview" className="relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-subtle/60">
      <div
        ref={frame}
        role="img"
        aria-label={t("Graph of the functions")}
        data-testid="graph-frame"
        className="touch-none select-none bg-white shadow-sm"
        style={{ width: W * scale, height: H * scale, cursor: tangentTool ? "crosshair" : grabbing ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setGrabbing(true);
          drag.current = { x: e.clientX, y: e.clientY, from: { xMin: graph.xMin, xMax: graph.xMax, yMin: graph.yMin, yMax: graph.yMax }, moved: false };
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(toGraph(e, r));
          const d = drag.current;
          if (!d) return;
          if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
          d.moved = true;
          const dx = ((e.clientX - d.x) / r.width) * (d.from.xMax - d.from.xMin);
          const dy = ((e.clientY - d.y) / r.height) * (d.from.yMax - d.from.yMin);
          onWindow({ xMin: d.from.xMin - dx, xMax: d.from.xMax - dx, yMin: d.from.yMin + dy, yMax: d.from.yMax + dy });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setGrabbing(false);
          if (!d || d.moved || !tangentTool) return;
          // a click (not a drag) with the tangent tool: the x of the click, on the finest grid line
          const x = toGraph(e, e.currentTarget.getBoundingClientRect()).x;
          const step = niceStep(graph.xMax - graph.xMin) / 10;
          onTangent(Math.round(x / step) * step);
        }}
        onPointerLeave={() => setAt(null)}
        onDoubleClick={() => onWindow({ xMin: -5, xMax: 5, yMin: -4, yMax: 6 })}
      >
        <Stage width={W * scale} height={H * scale} scaleX={scale} scaleY={scale} listening={false}>
          <Layer>
            <GraphView b={block} />
          </Layer>
        </Stage>
      </div>
      <p className="pointer-events-none absolute bottom-2 start-3 rounded-md bg-white/85 px-2 py-1 text-[11px] text-muted shadow-sm" data-testid="graph-readout">
        {readout ?? (tangentTool ? t("Click the graph to put a tangent there") : t("Drag to move · wheel to zoom · double-click to reset"))}
      </p>
    </div>
  );
}

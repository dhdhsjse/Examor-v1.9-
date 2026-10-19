"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { DEFAULT_MARGINS, MAX_MARGIN_MM, MIN_MARGIN_MM, mmToPx, pxToMm } from "@/app/_lib/a4";
import { questionNumbers, totalPoints as sumPoints } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { pageAt, pageBoxes, stackSize, type PageBox } from "@/app/_lib/pageStack";
import { snapBox, type Guide } from "@/app/_lib/snapping";
import type { Block, BlockLayout, ExamDoc, PageMargins, ViewMode } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import BlockNode, { type ResizeResult } from "./BlockNode";

const SNAP_PX = 6; // snap distance on screen, in pixels
const GUIDE_COLOR = "#c7d2fe"; // static margin/center guides
const EDIT_GUIDE_COLOR = "#818cf8"; // margin guides while the margins are being edited
const SHADE = "rgba(0,0,0,0.05)"; // outside the margins, while they are being edited
const GLIDE_SECONDS = 0.15; // margin guides move to new values instead of jumping
const HANDLE_LONG = 24; // margin handles, in screen pixels (the same at every zoom)
const HANDLE_SHORT = 6;

// Margins being edited (Page layout → Margins) and whether a handle is being dragged.
export type MarginEditView = { margins: PageMargins; dragging: boolean };

// A box drawn on a page with the text box tool (page pixels, relative to that page).
export type DrawnBox = { pageIndex: number; x: number; y: number; width: number; height: number };
const MIN_DRAWN = { width: 40, height: 20 }; // a smaller drag is taken for a click: no box
type DrawDraft = { page: number; x0: number; y0: number; x1: number; y1: number };
const SNAP_COLOR = "#ec4899"; // pink lines while dragging
const ACCENT = "#4f46e5";

interface Props {
  doc: ExamDoc;
  heights: Map<string, number>;
  numbers: Map<string, number>;
  mode: ViewMode;
  zoom: number;
  showGuides: boolean;
  // Margins being edited: drawn on every page (even with the guides off), the area outside them shaded,
  // with a handle on each side to drag them. Nothing else changes: blocks stay where they are.
  marginEdit?: MarginEditView | null;
  onMarginDrag?: (margins: PageMargins, done: boolean) => void;
  selectedId: string | null;
  interactive?: boolean; // false = clean render for the PDF
  stageRef?: RefObject<Konva.Stage | null>;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, pageId: string, x: number, y: number) => void;
  onResize?: (id: string, layout: Partial<BlockLayout>) => void;
  textTool?: boolean;
  onEdit?: (id: string, field: EditField | null) => void;
  onPatch?: (id: string, patch: BlockPatch) => void;
  onDragging?: (dragging: boolean) => void;
  onCreateText?: (at: { pageIndex: number; x: number; y: number }) => void;
  // Text box tool: dragging on a page draws a box (dashed while drawn) instead of selecting.
  drawBox?: boolean;
  onDrawBox?: (box: DrawnBox) => void;
  // A resize handle of the selected block is pressed (the text box editor stays open for it), and where
  // the block is while it is resized (stage = page stack coordinates; null = done).
  onHandleDown?: () => void;
  onResizing?: (id: string, r: ResizeResult | null) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// The box between where the mouse went down and where it is now (whichever way it was dragged).
const draftRect = (d: DrawDraft) => ({
  x: Math.min(d.x0, d.x1),
  y: Math.min(d.y0, d.y1),
  width: Math.abs(d.x1 - d.x0),
  height: Math.abs(d.y1 - d.y0),
});

// All pages on ONE Konva stage (real size: 794 x 1123 for an A4 page; each page has its own size,
// see pageBoxes), so blocks can be dragged from one page to another. Zoom is applied by CSS outside.
// Blocks keep positions relative to their page; the page's box places them on the stage.
export default function ExamCanvas(props: Props) {
  const { doc, heights, mode, zoom, showGuides, selectedId, interactive = true, stageRef } = props;
  const { pages, blocks, meta } = doc;
  const layerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [snap, setSnap] = useState<{ page: number; guides: Guide[] } | null>(null);
  // Where the dragged block would land, so question numbers update while dragging.
  const [dragAt, setDragAt] = useState<{ id: string; pageId: string; y: number } | null>(null);
  const numbers = useMemo(() => {
    if (!dragAt) return props.numbers;
    const moved = blocks.map((b) => (b.id === dragAt.id ? { ...b, layout: { ...b.layout, pageId: dragAt.pageId, y: dragAt.y } } : b));
    return questionNumbers(moved, pages);
  }, [dragAt, props.numbers, blocks, pages]);
  const boxes = useMemo(() => pageBoxes(pages), [pages]);
  const { width, height } = stackSize(boxes);
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));
  const selected = interactive ? blocks.find((b) => b.id === selectedId) : undefined;
  const guidesOn = showGuides && interactive;
  const edit = interactive ? props.marginEdit : null;
  const preview = edit?.margins;
  const totalPoints = useMemo(() => sumPoints(blocks), [blocks]);
  const drawing = interactive && !!props.drawBox;
  const [draft, setDraft] = useState<DrawDraft | null>(null);
  const stopDraw = useRef<(() => void) | null>(null);
  const onDrawBox = useRef(props.onDrawBox); // the latest one, for the release of a box drawn meanwhile
  useEffect(() => {
    onDrawBox.current = props.onDrawBox;
  });

  // Draw at a higher resolution when zoomed in, so text stays sharp.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const ratio = Math.min((window.devicePixelRatio || 1) * Math.max(1, zoom), 30000 / height);
    layer.getCanvas().setPixelRatio(ratio);
    layer.batchDraw();
  }, [zoom, height]);

  // Attach the resize handles to the selected block (none while a box is being drawn).
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selected && !drawing ? tr.getStage()?.findOne(`#${selected.id}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  });

  // While dragging: pick the closest page, snap to guides, keep the block inside that page.
  const handleDragMove = (b: Block, x: number, y: number) => {
    const h = heights.get(b.id) ?? 0;
    const i = pageAt(y + h / 2, boxes);
    const page = boxes[i];
    const others = blocks
      .filter((o) => o.id !== b.id && o.layout.pageId === pages[i].id)
      .map((o) => ({ ...o.layout, height: heights.get(o.id) ?? 0 }));

    const box = { x: x - page.left, y: y - page.top, width: b.layout.width, height: h };
    const snapped = guidesOn ? snapBox(box, others, { ...page, margins: pages[i].margins }, SNAP_PX / zoom) : { ...box, guides: [] };
    setSnap({ page: i, guides: snapped.guides });
    const pos = { x: clamp(snapped.x, 0, page.width - b.layout.width), y: clamp(snapped.y, 0, page.height - h) };
    if (dragAt?.pageId !== pages[i].id || dragAt.y !== pos.y) setDragAt({ id: b.id, pageId: pages[i].id, y: pos.y });
    return { x: page.left + pos.x, y: page.top + pos.y };
  };

  // Drop: save which page the block landed on and its position on that page.
  const handleDragEnd = (b: Block, x: number, y: number) => {
    const i = pageAt(y + (heights.get(b.id) ?? 0) / 2, boxes);
    setSnap(null);
    setDragAt(null);
    props.onDragging?.(false);
    props.onMove?.(b.id, pages[i].id, x - boxes[i].left, y - boxes[i].top);
  };

  // Resize end: keep the block inside its page; images/equations keep their shape.
  const handleResize = (b: Block, r: ResizeResult) => {
    const i = pageAt(r.y + r.height / 2, boxes);
    const page = boxes[i];
    const width = clamp(r.width, 40, page.width);
    const ratio = b.type === "image" ? b.ratio : b.type === "equation" ? b.exW / Math.max(0.1, b.exH) : 0;
    const graph = b.type === "graph" || b.type === "textbox"; // graphs and text boxes can change shape freely
    const h = graph ? clamp(r.height, b.type === "textbox" ? 30 : 80, page.height) : ratio ? width / ratio : (heights.get(b.id) ?? 0);
    props.onResize?.(b.id, {
      pageId: pages[i].id,
      x: clamp(r.x - page.left, 0, page.width - width),
      y: clamp(r.y - page.top, 0, page.height - h),
      width,
      ...(ratio || graph ? { height: h } : {}),
    });
  };

  // Text box tool: a crosshair over the pages. Leaving the tool (Escape, another tool) drops a box
  // being drawn; so does closing the page.
  useEffect(() => {
    const container = layerRef.current?.getStage()?.container();
    if (container) container.style.cursor = drawing ? "crosshair" : "";
    if (!drawing) stopDraw.current?.();
  }, [drawing]);
  useEffect(() => () => stopDraw.current?.(), []);

  // Mouse down on a page with the text box tool: follow the mouse (even outside the canvas) within that
  // page, then hand the box over on release, unless it is too small to be meant.
  const startDraw = (stage: Konva.Stage, x: number, y: number) => {
    const page = pageAt(y, boxes);
    const box = boxes[page];
    let d: DrawDraft = { page, x0: x, y0: y, x1: x, y1: y };
    setDraft(d);
    const follow = (e: MouseEvent) => {
      stage.setPointersPositions(e);
      const p = stage.getPointerPosition();
      if (!p) return;
      d = { ...d, x1: clamp(p.x, box.left, box.left + box.width), y1: clamp(p.y, box.top, box.top + box.height) };
      setDraft(d);
    };
    const stop = () => {
      window.removeEventListener("mousemove", follow);
      window.removeEventListener("mouseup", release);
      stopDraw.current = null;
      setDraft(null);
    };
    const release = (e: MouseEvent) => {
      follow(e);
      stop();
      const r = draftRect(d);
      if (r.width < MIN_DRAWN.width || r.height < MIN_DRAWN.height) return;
      onDrawBox.current?.({ pageIndex: page, x: r.x - box.left, y: r.y - box.top, width: r.width, height: r.height });
    };
    window.addEventListener("mousemove", follow);
    window.addEventListener("mouseup", release);
    stopDraw.current = stop;
  };

  const media = selected?.type === "image" || selected?.type === "equation";
  const corners = media || selected?.type === "graph";
  const freeBox = selected?.type === "textbox"; // a text box: every side and corner

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      // Clicking empty paper clears the selection (with the T tool: starts a new text there; with the
      // text box tool: starts drawing a box, blocks let the mouse through then).
      onMouseDown={(e) => {
        if (e.target !== e.target.getStage() && e.target.name() !== "paper") return;
        props.onSelect?.(null);
        const stage = e.target.getStage();
        const p = stage?.getPointerPosition();
        if (drawing && stage && p && e.target.name() === "paper" && e.evt.button === 0) {
          e.evt.preventDefault(); // no text selection while dragging
          startDraw(stage, p.x, p.y);
        } else if (props.textTool && p && e.target.name() === "paper") {
          e.evt.preventDefault(); // keep the focus in the new text box
          const i = pageAt(p.y, boxes);
          props.onCreateText?.({ pageIndex: i, x: p.x - boxes[i].left, y: p.y - boxes[i].top });
        }
      }}
    >
      <Layer ref={layerRef}>
        {pages.map((page, i) => (
          <PaperSheet
            key={page.id}
            box={boxes[i]}
            margins={preview ?? page.margins}
            showGuides={guidesOn || !!preview}
            editing={!!preview}
            instant={!!edit?.dragging}
            zoom={zoom}
          />
        ))}

        {blocks.map((b) => (
          <BlockNode
            key={b.id}
            block={b}
            x={boxes[pageIndex.get(b.layout.pageId) ?? 0].left + b.layout.x}
            y={boxes[pageIndex.get(b.layout.pageId) ?? 0].top + b.layout.y}
            height={heights.get(b.id) ?? 0}
            number={numbers.get(b.id) ?? 0}
            meta={meta}
            mode={mode}
            totalPoints={totalPoints}
            zoom={zoom}
            selected={b.id === selectedId}
            interactive={interactive}
            textTool={!!props.textTool}
            drawing={drawing}
            onSelect={() => props.onSelect?.(b.id)}
            onDragStart={() => props.onDragging?.(true)}
            onEdit={(field) => props.onEdit?.(b.id, field)}
            onPatch={(patch) => props.onPatch?.(b.id, patch)}
            onDragMove={(x, y) => handleDragMove(b, x, y)}
            onDragEnd={(x, y) => handleDragEnd(b, x, y)}
            onResize={(r) => handleResize(b, r)}
            onResizing={(r) => props.onResizing?.(b.id, r)}
          />
        ))}

        {/* While the margins are edited: the area outside them is shaded (over the blocks; clicks go through it) */}
        {preview && pages.map((page, i) => <MarginShade key={page.id} box={boxes[i]} margins={preview} instant={!!edit?.dragging} />)}
        {preview &&
          pages.map((page, i) => (
            <MarginHandles key={page.id} box={boxes[i]} margins={preview} zoom={zoom} onDrag={(m, done) => props.onMarginDrag?.(m, done)} />
          ))}

        {/* The text box being drawn */}
        {draft && (
          <Rect
            {...draftRect(draft)}
            fill="rgba(0,0,0,0.05)"
            stroke={ACCENT}
            strokeWidth={1 / zoom}
            dash={[4 / zoom, 4 / zoom]}
            listening={false}
          />
        )}

        {/* Pink alignment lines on the page being dragged over */}
        {snap?.guides.map((g, k) => {
          const page = boxes[snap.page];
          const { top, left } = page;
          return (
            <Line
              key={k}
              points={g.axis === "x" ? [left + g.pos, top, left + g.pos, top + page.height] : [left, top + g.pos, left + page.width, top + g.pos]}
              stroke={SNAP_COLOR}
              strokeWidth={1 / zoom}
              listening={false}
            />
          );
        })}

        {/* Resize handles: corners for images/equations, sides for the rest, none for the header */}
        {interactive && (
          <Transformer
            ref={trRef}
            onMouseDown={() => props.onHandleDown?.()}
            rotateEnabled={false}
            keepRatio={media}
            enabledAnchors={
              selected?.type === "header"
                ? []
                : freeBox
                  ? ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
                  : corners
                    ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                    : ["middle-left", "middle-right"]
            }
            flipEnabled={false}
            borderStroke={ACCENT}
            borderStrokeWidth={1.2 / zoom}
            anchorStroke={ACCENT}
            anchorStrokeWidth={1 / zoom}
            anchorSize={9 / zoom}
            anchorCornerRadius={2 / zoom}
            padding={2 / zoom}
            ignoreStroke
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 40 || newBox.width > width + 4 ? oldBox : newBox)}
          />
        )}
      </Layer>
    </Stage>
  );
}

// One white sheet, with margin box + center line when guides are on.
function PaperSheet({ box, margins, showGuides, editing, instant, zoom }: {
  box: PageBox;
  margins?: PageMargins;
  showGuides: boolean;
  editing: boolean;
  instant: boolean;
  zoom: number;
}) {
  const m = margins ?? DEFAULT_MARGINS;
  const { top, left } = box;
  const width = box.width - m.left - m.right;
  const height = box.height - m.top - m.bottom;
  const color = editing ? EDIT_GUIDE_COLOR : GUIDE_COLOR;
  return (
    <>
      <Rect name="paper" x={left} y={top} width={box.width} height={box.height} fill="#ffffff" />
      {showGuides && (
        <>
          <GlideRect x={left + m.left} y={top + m.top} width={width} height={height} instant={instant} stroke={color} strokeWidth={1 / zoom} dash={[6, 4]} />
          <GlideLine x={left + m.left + width / 2} y={top + m.top} length={height} instant={instant} stroke={color} strokeWidth={1 / zoom} dash={[2, 6]} />
        </>
      )}
    </>
  );
}

// The four bands of a page outside its margins.
function MarginShade({ box, margins: m, instant }: { box: PageBox; margins: PageMargins; instant: boolean }) {
  const { top, left, width, height } = box;
  const middle = height - m.top - m.bottom;
  return (
    <>
      <GlideRect x={left} y={top} width={width} height={m.top} instant={instant} fill={SHADE} />
      <GlideRect x={left} y={top + height - m.bottom} width={width} height={m.bottom} instant={instant} fill={SHADE} />
      <GlideRect x={left} y={top + m.top} width={m.left} height={middle} instant={instant} fill={SHADE} />
      <GlideRect x={left + width - m.right} y={top + m.top} width={m.right} height={middle} instant={instant} fill={SHADE} />
    </>
  );
}

type Side = keyof PageMargins;
const clampMm = (mm: number) => Math.max(MIN_MARGIN_MM, Math.min(mm, MAX_MARGIN_MM));

// A handle in the middle of each side of the printable area. Dragging one moves that margin in whole
// millimetres, within the allowed range; `onDrag` gets the new margins (done = released).
function MarginHandles({ box, margins: m, zoom, onDrag }: {
  box: PageBox;
  margins: PageMargins;
  zoom: number;
  onDrag: (m: PageMargins, done: boolean) => void;
}) {
  const { top, left } = box;
  const right = left + box.width;
  const bottom = top + box.height;
  const midX = left + m.left + (box.width - m.left - m.right) / 2;
  const midY = top + m.top + (box.height - m.top - m.bottom) / 2;
  // Each side: where its handle sits for a margin of `px`, and the margin for a handle at (x, y).
  const sides: { side: Side; at: (px: number) => { x: number; y: number }; margin: (x: number, y: number) => number }[] = [
    { side: "top", at: (px) => ({ x: midX, y: top + px }), margin: (_, y) => y - top },
    { side: "bottom", at: (px) => ({ x: midX, y: bottom - px }), margin: (_, y) => bottom - y },
    { side: "left", at: (px) => ({ x: left + px, y: midY }), margin: (x) => x - left },
    { side: "right", at: (px) => ({ x: right - px, y: midY }), margin: (x) => right - x },
  ];
  const cursor = (e: Konva.KonvaEventObject<MouseEvent | DragEvent>, value: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = value;
  };
  return (
    <>
      {sides.map(({ side, at, margin }) => {
        const across = side === "left" || side === "right";
        const resize = across ? "ew-resize" : "ns-resize";
        const width = (across ? HANDLE_SHORT : HANDLE_LONG) / zoom;
        const height = (across ? HANDLE_LONG : HANDLE_SHORT) / zoom;
        const snapped = (x: number, y: number) => mmToPx(clampMm(pxToMm(margin(x, y))));
        const update = (node: Konva.Node, done: boolean) => onDrag({ ...m, [side]: snapped(node.x(), node.y()) }, done);
        return (
          <Rect
            key={side}
            {...at(m[side])}
            width={width}
            height={height}
            offsetX={width / 2}
            offsetY={height / 2}
            fill="#ffffff"
            stroke={ACCENT}
            strokeWidth={1 / zoom}
            cornerRadius={3 / zoom}
            shadowColor="rgba(0,0,0,0.2)"
            shadowBlur={4 / zoom}
            hitStrokeWidth={8 / zoom}
            draggable
            // The stage itself is not scaled (the zoom is CSS outside it), so absolute = page-stack coordinates.
            dragBoundFunc={(pos) => at(snapped(pos.x, pos.y))}
            onMouseEnter={(e) => cursor(e, resize)}
            onMouseLeave={(e) => !e.target.isDragging() && cursor(e, "")}
            onDragMove={(e) => update(e.target, false)}
            onDragEnd={(e) => {
              cursor(e, "");
              update(e.target, true);
            }}
          />
        );
      })}
    </>
  );
}

// Konva has no CSS transitions: a node moves to its new place with a short tween instead (a new tween
// takes over from a running one). `instant` follows at once, e.g. while a margin handle is dragged.
// Only the first place goes through props (react-konva would jump the node there otherwise).
function glide(node: Konva.Node | null, attrs: Konva.NodeConfig, instant: boolean) {
  const still = instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node?.to({ ...attrs, duration: still ? 0 : GLIDE_SECONDS });
}

type Stroke = { instant: boolean; stroke?: string; strokeWidth?: number; dash?: number[]; fill?: string };

function GlideRect({ x, y, width, height, instant, ...style }: { x: number; y: number; width: number; height: number } & Stroke) {
  const ref = useRef<Konva.Rect>(null);
  const [start] = useState({ x, y, width, height });
  useEffect(() => glide(ref.current, { x, y, width, height }, instant), [x, y, width, height, instant]);
  return <Rect ref={ref} {...start} {...style} listening={false} />;
}

// A vertical line from (x, y), `length` long.
function GlideLine({ x, y, length, instant, ...style }: { x: number; y: number; length: number } & Stroke) {
  const ref = useRef<Konva.Line>(null);
  const [start] = useState({ x, y, points: [0, 0, 0, length] });
  useEffect(() => glide(ref.current, { x, y, points: [0, 0, 0, length] }, instant), [x, y, length, instant]);
  return <Line ref={ref} {...start} {...style} listening={false} />;
}

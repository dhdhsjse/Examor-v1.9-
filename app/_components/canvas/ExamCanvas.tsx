"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { DEFAULT_MARGINS, MAX_MARGIN_MM, MIN_MARGIN_MM, PAGE_HEIGHT, PAGE_WIDTH, mmToPx, pxToMm } from "@/app/_lib/a4";
import { questionNumbers, totalPoints as sumPoints } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { pageAt, pageTop, stackHeight } from "@/app/_lib/pageStack";
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
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// All pages on ONE Konva stage (real A4 size: 794 x 1123 per page), so blocks can be
// dragged from one page to another. Zoom is applied by CSS outside.
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
  const height = stackHeight(pages.length);
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));
  const selected = interactive ? blocks.find((b) => b.id === selectedId) : undefined;
  const guidesOn = showGuides && interactive;
  const edit = interactive ? props.marginEdit : null;
  const preview = edit?.margins;
  const totalPoints = useMemo(() => sumPoints(blocks), [blocks]);

  // Draw at a higher resolution when zoomed in, so text stays sharp.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const ratio = Math.min((window.devicePixelRatio || 1) * Math.max(1, zoom), 30000 / height);
    layer.getCanvas().setPixelRatio(ratio);
    layer.batchDraw();
  }, [zoom, height]);

  // Attach the resize handles to the selected block.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selected ? tr.getStage()?.findOne(`#${selected.id}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  });

  // While dragging: pick the closest page, snap to guides, keep the block inside that page.
  const handleDragMove = (b: Block, x: number, y: number) => {
    const h = heights.get(b.id) ?? 0;
    const i = pageAt(y + h / 2, pages.length);
    const top = pageTop(i);
    const others = blocks
      .filter((o) => o.id !== b.id && o.layout.pageId === pages[i].id)
      .map((o) => ({ ...o.layout, height: heights.get(o.id) ?? 0 }));

    const box = { x, y: y - top, width: b.layout.width, height: h };
    const snapped = guidesOn ? snapBox(box, others, SNAP_PX / zoom) : { ...box, guides: [] };
    setSnap({ page: i, guides: snapped.guides });
    const pos = { x: clamp(snapped.x, 0, PAGE_WIDTH - b.layout.width), y: clamp(snapped.y, 0, PAGE_HEIGHT - h) };
    if (dragAt?.pageId !== pages[i].id || dragAt.y !== pos.y) setDragAt({ id: b.id, pageId: pages[i].id, y: pos.y });
    return { x: pos.x, y: top + pos.y };
  };

  // Drop: save which page the block landed on and its position on that page.
  const handleDragEnd = (b: Block, x: number, y: number) => {
    const i = pageAt(y + (heights.get(b.id) ?? 0) / 2, pages.length);
    setSnap(null);
    setDragAt(null);
    props.onDragging?.(false);
    props.onMove?.(b.id, pages[i].id, x, y - pageTop(i));
  };

  // Resize end: keep the block inside its page; images/equations keep their shape.
  const handleResize = (b: Block, r: ResizeResult) => {
    const width = clamp(r.width, 40, PAGE_WIDTH);
    const ratio = b.type === "image" ? b.ratio : b.type === "equation" ? b.exW / Math.max(0.1, b.exH) : 0;
    const graph = b.type === "graph"; // graphs can change shape freely
    const h = graph ? clamp(r.height, 80, PAGE_HEIGHT) : ratio ? width / ratio : (heights.get(b.id) ?? 0);
    const i = pageAt(r.y + h / 2, pages.length);
    props.onResize?.(b.id, {
      pageId: pages[i].id,
      x: clamp(r.x, 0, PAGE_WIDTH - width),
      y: clamp(r.y - pageTop(i), 0, PAGE_HEIGHT - h),
      width,
      ...(ratio || graph ? { height: h } : {}),
    });
  };

  const media = selected?.type === "image" || selected?.type === "equation";
  const corners = media || selected?.type === "graph";

  return (
    <Stage
      ref={stageRef}
      width={PAGE_WIDTH}
      height={height}
      // Clicking empty paper clears the selection (with the T tool: starts a new text there).
      onMouseDown={(e) => {
        if (e.target !== e.target.getStage() && e.target.name() !== "paper") return;
        props.onSelect?.(null);
        const p = e.target.getStage()?.getPointerPosition();
        if (props.textTool && p && e.target.name() === "paper") {
          e.evt.preventDefault(); // keep the focus in the new text box
          const i = pageAt(p.y, pages.length);
          props.onCreateText?.({ pageIndex: i, x: p.x, y: p.y - pageTop(i) });
        }
      }}
    >
      <Layer ref={layerRef}>
        {pages.map((page, i) => (
          <PaperSheet
            key={page.id}
            top={pageTop(i)}
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
            x={b.layout.x}
            y={pageTop(pageIndex.get(b.layout.pageId) ?? 0) + b.layout.y}
            height={heights.get(b.id) ?? 0}
            number={numbers.get(b.id) ?? 0}
            meta={meta}
            mode={mode}
            totalPoints={totalPoints}
            zoom={zoom}
            selected={b.id === selectedId}
            interactive={interactive}
            textTool={!!props.textTool}
            onSelect={() => props.onSelect?.(b.id)}
            onDragStart={() => props.onDragging?.(true)}
            onEdit={(field) => props.onEdit?.(b.id, field)}
            onPatch={(patch) => props.onPatch?.(b.id, patch)}
            onDragMove={(x, y) => handleDragMove(b, x, y)}
            onDragEnd={(x, y) => handleDragEnd(b, x, y)}
            onResize={(r) => handleResize(b, r)}
          />
        ))}

        {/* While the margins are edited: the area outside them is shaded (over the blocks; clicks go through it) */}
        {preview && pages.map((page, i) => <MarginShade key={page.id} top={pageTop(i)} margins={preview} instant={!!edit?.dragging} />)}
        {preview &&
          pages.map((page, i) => (
            <MarginHandles key={page.id} top={pageTop(i)} margins={preview} zoom={zoom} onDrag={(m, done) => props.onMarginDrag?.(m, done)} />
          ))}

        {/* Pink alignment lines on the page being dragged over */}
        {snap?.guides.map((g, k) => {
          const top = pageTop(snap.page);
          return (
            <Line
              key={k}
              points={g.axis === "x" ? [g.pos, top, g.pos, top + PAGE_HEIGHT] : [0, top + g.pos, PAGE_WIDTH, top + g.pos]}
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
            rotateEnabled={false}
            keepRatio={media}
            enabledAnchors={
              selected?.type === "header" ? [] : corners ? ["top-left", "top-right", "bottom-left", "bottom-right"] : ["middle-left", "middle-right"]
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
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 40 || newBox.width > PAGE_WIDTH + 4 ? oldBox : newBox)}
          />
        )}
      </Layer>
    </Stage>
  );
}

// One white A4 sheet, with margin box + center line when guides are on.
function PaperSheet({ top, margins, showGuides, editing, instant, zoom }: {
  top: number;
  margins?: PageMargins;
  showGuides: boolean;
  editing: boolean;
  instant: boolean;
  zoom: number;
}) {
  const m = margins ?? DEFAULT_MARGINS;
  const width = PAGE_WIDTH - m.left - m.right;
  const height = PAGE_HEIGHT - m.top - m.bottom;
  const color = editing ? EDIT_GUIDE_COLOR : GUIDE_COLOR;
  return (
    <>
      <Rect name="paper" y={top} width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="#ffffff" />
      {showGuides && (
        <>
          <GlideRect x={m.left} y={top + m.top} width={width} height={height} instant={instant} stroke={color} strokeWidth={1 / zoom} dash={[6, 4]} />
          <GlideLine x={m.left + width / 2} y={top + m.top} length={height} instant={instant} stroke={color} strokeWidth={1 / zoom} dash={[2, 6]} />
        </>
      )}
    </>
  );
}

// The four bands of a page outside its margins.
function MarginShade({ top, margins: m, instant }: { top: number; margins: PageMargins; instant: boolean }) {
  const middle = PAGE_HEIGHT - m.top - m.bottom;
  return (
    <>
      <GlideRect x={0} y={top} width={PAGE_WIDTH} height={m.top} instant={instant} fill={SHADE} />
      <GlideRect x={0} y={top + PAGE_HEIGHT - m.bottom} width={PAGE_WIDTH} height={m.bottom} instant={instant} fill={SHADE} />
      <GlideRect x={0} y={top + m.top} width={m.left} height={middle} instant={instant} fill={SHADE} />
      <GlideRect x={PAGE_WIDTH - m.right} y={top + m.top} width={m.right} height={middle} instant={instant} fill={SHADE} />
    </>
  );
}

type Side = keyof PageMargins;
const clampMm = (mm: number) => Math.max(MIN_MARGIN_MM, Math.min(mm, MAX_MARGIN_MM));

// A handle in the middle of each side of the printable area. Dragging one moves that margin in whole
// millimetres, within the allowed range; `onDrag` gets the new margins (done = released).
function MarginHandles({ top, margins: m, zoom, onDrag }: {
  top: number;
  margins: PageMargins;
  zoom: number;
  onDrag: (m: PageMargins, done: boolean) => void;
}) {
  const midX = m.left + (PAGE_WIDTH - m.left - m.right) / 2;
  const midY = top + m.top + (PAGE_HEIGHT - m.top - m.bottom) / 2;
  // Each side: where its handle sits for a margin of `px`, and the margin for a handle at (x, y).
  const sides: { side: Side; at: (px: number) => { x: number; y: number }; margin: (x: number, y: number) => number }[] = [
    { side: "top", at: (px) => ({ x: midX, y: top + px }), margin: (_, y) => y - top },
    { side: "bottom", at: (px) => ({ x: midX, y: top + PAGE_HEIGHT - px }), margin: (_, y) => top + PAGE_HEIGHT - y },
    { side: "left", at: (px) => ({ x: px, y: midY }), margin: (x) => x },
    { side: "right", at: (px) => ({ x: PAGE_WIDTH - px, y: midY }), margin: (x) => PAGE_WIDTH - x },
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

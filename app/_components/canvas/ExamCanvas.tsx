"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "@/app/_lib/a4";
import { isQuestion, questionNumbers } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { pageAt, pageTop, stackHeight } from "@/app/_lib/pageStack";
import { snapBox, type Guide } from "@/app/_lib/snapping";
import type { Block, BlockLayout, ExamDoc, ViewMode } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import BlockNode, { type ResizeResult } from "./BlockNode";

const SNAP_PX = 6; // snap distance on screen, in pixels
const GUIDE_COLOR = "#c7d2fe"; // static margin/center guides
const SNAP_COLOR = "#ec4899"; // pink lines while dragging
const ACCENT = "#4f46e5";

interface Props {
  doc: ExamDoc;
  heights: Map<string, number>;
  numbers: Map<string, number>;
  mode: ViewMode;
  zoom: number;
  showGuides: boolean;
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
  const totalPoints = useMemo(() => blocks.filter(isQuestion).reduce((s, q) => s + q.points, 0), [blocks]);

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
          <PaperSheet key={page.id} top={pageTop(i)} showGuides={guidesOn} zoom={zoom} />
        ))}

        {blocks.map((b) => (
          <BlockNode
            key={b.id}
            block={b}
            x={b.layout.x}
            y={pageTop(pageIndex.get(b.layout.pageId) ?? 0) + b.layout.y}
            height={heights.get(b.id) ?? 0}
            number={numbers.get(b.id) ?? 0}
            lang={meta.lang}
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
function PaperSheet({ top, showGuides, zoom }: { top: number; showGuides: boolean; zoom: number }) {
  return (
    <>
      <Rect name="paper" y={top} width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="#ffffff" />
      {showGuides && (
        <>
          <Rect
            x={PAGE_MARGIN}
            y={top + PAGE_MARGIN}
            width={PAGE_WIDTH - PAGE_MARGIN * 2}
            height={PAGE_HEIGHT - PAGE_MARGIN * 2}
            stroke={GUIDE_COLOR}
            strokeWidth={1 / zoom}
            dash={[6, 4]}
            listening={false}
          />
          <Line
            points={[PAGE_WIDTH / 2, top + PAGE_MARGIN, PAGE_WIDTH / 2, top + PAGE_HEIGHT - PAGE_MARGIN]}
            stroke={GUIDE_COLOR}
            strokeWidth={1 / zoom}
            dash={[2, 6]}
            listening={false}
          />
        </>
      )}
    </>
  );
}

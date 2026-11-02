"use client";

import type Konva from "konva";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { InkStroke } from "@/app/_components/shapes/InkGraphic";
import { InkCapture, finishInk, type InkPoint, type InkSettings, type InkTool } from "@/app/_lib/ink/engine";
import { eraserCursor, eraserPoints, type EraserSettings } from "@/app/_lib/ink/eraser";
import { DEFAULT_MARGINS, MAX_MARGIN_MM, MIN_MARGIN_MM, mmToPx, pxToMm } from "@/app/_lib/a4";
import { questionNumbers, totalPoints as sumPoints } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { pageAt, pageBoxes, stackSize, type PageBox } from "@/app/_lib/pageStack";
import { MIN_SHAPE_SIZE, isLine } from "@/app/_lib/shapes";
import { isFixedTable } from "@/app/_lib/table";
import { snapBox, type Guide } from "@/app/_lib/snapping";
import { slotDrop } from "@/app/_lib/textboxSlots";
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

// A stroke of the drawing tools, done: its points in the pixels of the page it was drawn on.
export type DrawnInk = { pageIndex: number; tool: InkTool; settings: InkSettings; points: InkPoint[] };
/** The drawing tool in hand and how it draws */
export type InkInHand = InkSettings & { tool: InkTool };

// Margins being edited (Page layout → Margins) and whether a handle is being dragged.
export type MarginEditView = { margins: PageMargins; dragging: boolean };

// A box drawn on a page with the text box tool (page pixels, relative to that page).
// (`flipX` / `flipY`: a line drawn leftwards / upwards; a click without a drag has no size: width and height 0, and x, y are where it was)
export type DrawnBox = { pageIndex: number; x: number; y: number; width: number; height: number; flipX?: boolean; flipY?: boolean };
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
  // With the Shapes tool: what is drawn is a shape (a box, or a line from one corner to the other): a click is allowed, and Shift keeps it square / at 45°.
  drawShape?: "box" | "line";
  onDrawBox?: (box: DrawnBox) => void;
  // The Draw tool (brush, pencil, highlighter): a drag on a page draws a stroke, over the blocks (they let the mouse through).
  ink?: InkInHand | null;
  onInk?: (stroke: DrawnInk) => void;
  // The eraser (its way of rubbing and the width of its tip, screen px): a drag on a page rubs out the parts of the drawings it goes
  // over (`onEraseInk`: the way it went on that page, page px), or with the stroke eraser the whole drawings and shapes it touches
  // (`onErase`; the other blocks let the mouse through). `key` names the stroke of the eraser: one step of the undo.
  eraser?: EraserSettings | null;
  onErase?: (ids: string[], key: string) => void;
  onEraseInk?: (pageId: string, path: { x: number; y: number }[], radius: number, key: string) => void;
  // A resize handle of the selected block is pressed (the text box editor stays open for it), and where
  // the block is while it is resized (stage = page stack coordinates; null = done).
  onHandleDown?: () => void;
  onResizing?: (id: string, r: ResizeResult | null) => void;
  // A block moved from outside the stage (the text box being typed in, dragged by its edge): it is not drawn here
  // meanwhile (`hiddenId`), and `mover` snaps it and drops it like a block dragged on the canvas.
  hiddenId?: string | null;
  typingId?: string | null; // the text box being typed in: the page draws only its fill and border (its editor is see-through)
  mover?: RefObject<BlockMover | null>;
}

// Moving a block from outside (page stack pixels): `move` gives where it goes (snapped, inside its page), `end` drops it there.
export type BlockMover = { move: (id: string, x: number, y: number) => { x: number; y: number }; end: (id: string, x: number, y: number) => void };

// Blocks drawn over all the others (see drawOrder).
const ON_TOP = new Set<Block["type"]>(["shape", "image", "graph", "equation"]);

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
  // The order blocks are drawn in, decided here (not by moving Konva nodes, which React would not know about): the exam's
  // order, each text box followed by the blocks of its text (over the box's background, in the order of its text), and the
  // last block dragged with its blocks over the others.
  const [liftedId, setLiftedId] = useState<string | null>(null);
  // A block of a text box being dragged in it: where it would go (a line across the box's text, stage px).
  const [slotLine, setSlotLine] = useState<{ left: number; top: number; width: number } | null>(null);
  const inBox = useMemo(() => {
    const m = new Map<string, Block[]>();
    for (const b of blocks) if (b.meta?.slot) m.set(b.meta.slot, [...(m.get(b.meta.slot) ?? []), b]);
    for (const list of m.values()) list.sort((a, c) => a.layout.y - c.layout.y);
    return m;
  }, [blocks]);
  const drawOrder = useMemo(() => {
    const ids = new Set(blocks.map((b) => b.id));
    const withOwn = (b: Block) => [b, ...(inBox.get(b.id) ?? [])];
    const loose = blocks.filter((b) => !b.meta?.slot || !ids.has(b.meta.slot)); // (a block whose box is gone is drawn on its own)
    // Two layers: text, questions, tables, text boxes… below; shapes, images, graphs and equations always over them
    // (drawn on a page, they are never hidden by a text box). In each, the saved stacking order (layout.z, raised when a block is
    // dropped — so the PDF stacks them as the page does), then the block being dragged right now over all of them.
    const layer = (list: Block[]) => {
      const lifted = list.find((b) => b.id === liftedId);
      const rest = list.filter((b) => b !== lifted).sort((a, c) => (a.layout.z ?? 0) - (c.layout.z ?? 0)); // (stable: same z → exam's order)
      return [...rest.flatMap(withOwn), ...(lifted ? withOwn(lifted) : [])];
    };
    return [...layer(loose.filter((b) => !ON_TOP.has(b.type))), ...layer(loose.filter((b) => ON_TOP.has(b.type)))];
  }, [blocks, inBox, liftedId]);
  const boxes = useMemo(() => pageBoxes(pages), [pages]);
  const { width, height } = stackSize(boxes);
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));
  const selected = interactive ? blocks.find((b) => b.id === selectedId) : undefined;

  // Blocks over each other (a text under a photo…): the selected block takes the clicks even where another block is drawn over
  // it, so it can be moved and typed in there. Its node goes over all the others, unseen ("ghost"), and a copy of it that lets
  // the mouse through ("passive") is drawn in its place in the stack, so the page looks the same. While it is dragged or resized
  // the node itself is shown (over the others, as a dragged block already is). A text box comes up with the blocks of its text.
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [ghostHover, setGhostHover] = useState(false);
  const raised = !!selected && (liftedId === selected.id || resizingId === selected.id);
  const ghostIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const inABox = !!selected.meta?.slot && blocks.some((o) => o.id === selected.meta?.slot);
    return new Set([selected.id, ...(inABox ? [] : (inBox.get(selected.id) ?? []).map((o) => o.id))]);
  }, [selected, blocks, inBox]);
  const shown = drawOrder.filter((b) => b.id !== props.hiddenId);

  // Alt+click: the block under the one clicked (again: the next one down, then back to the top one), as the page stacks them.
  const pick = (b: Block, alt: boolean) => {
    let id = b.id;
    const p = alt ? layerRef.current?.getStage()?.getPointerPosition() : null;
    if (p) {
      const under = shown
        .filter((o) => {
          const page = boxes[pageIndex.get(o.layout.pageId) ?? 0];
          const x0 = page.left + o.layout.x;
          const y0 = page.top + o.layout.y;
          return p.x >= x0 && p.x <= x0 + o.layout.width && p.y >= y0 && p.y <= y0 + (heights.get(o.id) ?? 0);
        })
        .reverse(); // top first
      const at = under.findIndex((o) => o.id === selectedId);
      const from = at >= 0 ? at : under.findIndex((o) => o.id === b.id);
      if (under.length > 1) id = under[(from + 1) % under.length].id;
    }
    props.onSelect?.(id);
    return id === b.id;
  };
  const guidesOn = showGuides && interactive;
  const edit = interactive ? props.marginEdit : null;
  const preview = edit?.margins;
  const totalPoints = useMemo(() => sumPoints(blocks), [blocks]);
  const inking = interactive && !!props.ink;
  const drawing = interactive && (!!props.drawBox || inking);
  const erasing = interactive && !!props.eraser;
  const [draft, setDraft] = useState<DrawDraft | null>(null);
  const stopDraw = useRef<(() => void) | null>(null);
  const onDrawBox = useRef(props.onDrawBox); // the latest one, for the release of a box drawn meanwhile
  const drawShape = useRef(props.drawShape);
  const ink = useRef(props.ink);
  const onInk = useRef(props.onInk);
  const onErase = useRef(props.onErase);
  const onEraseInk = useRef(props.onEraseInk);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    onDrawBox.current = props.onDrawBox;
    drawShape.current = props.drawShape;
    ink.current = props.ink;
    onInk.current = props.onInk;
    onErase.current = props.onErase;
    onEraseInk.current = props.onEraseInk;
    zoomRef.current = zoom;
  });
  // The stroke being drawn is shown on a layer of its own (only it is redrawn while the mouse moves).
  const liveInk = useRef<((s: LiveInk | null) => void) | null>(null);
  const inkLayerRef = useRef<Konva.Layer>(null);
  useEffect(() => {
    const layer = inkLayerRef.current;
    if (!layer) return;
    layer.getCanvas().setPixelRatio(Math.min((window.devicePixelRatio || 1) * Math.max(1, zoom), 30000 / height));
    layer.batchDraw();
  }, [zoom, height, inking]);

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
    const node = selected && !drawing && !erasing ? tr.getStage()?.findOne(`#${selected.id}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  });

  // The blocks placed in a text box (questions, tables… in its text, textboxSlots.ts) go with it while it is dragged.
  const embeddedNodes = (b: Block) => {
    const layer = layerRef.current;
    if (!layer || b.type !== "textbox") return [];
    return (inBox.get(b.id) ?? []).flatMap((o) => {
      const node = layer.findOne(`#${o.id}`);
      return node ? [{ node, dx: o.layout.x - b.layout.x, dy: o.layout.y - b.layout.y }] : [];
    });
  };
  const handleDragStart = (b: Block) => {
    setLiftedId(b.id);
    props.onDragging?.(true);
  };
  const followBox = (b: Block, pos: { x: number; y: number }) => {
    embeddedNodes(b).forEach(({ node, dx, dy }) => node.position({ x: pos.x + dx, y: pos.y + dy }));
  };

  // While dragging: pick the closest page, snap to guides, keep the block inside that page.
  const handleDragMove = (b: Block, x: number, y: number) => {
    const at = placeDragged(b, x, y);
    followBox(b, at);
    return at;
  };
  const placeDragged = (b: Block, x: number, y: number) => {
    const h = heights.get(b.id) ?? 0;
    // A block in a text box's text moves up and down in its box only: it goes above or below the box's other blocks and paragraphs
    // (where it would land is shown by a line).
    const owner = b.meta?.slot ? blocks.find((o) => o.id === b.meta?.slot) : undefined;
    if (owner) {
      const i = pageIndex.get(owner.layout.pageId) ?? 0;
      const page = boxes[i];
      const top = owner.layout.y - h / 2;
      const bottom = owner.layout.y + (heights.get(owner.id) ?? 0) - h / 2;
      const py = clamp(y - page.top, top, Math.max(top, bottom));
      const drop = slotDrop(doc, b.id, py + h / 2);
      setSlotLine(drop && !drop.same ? { left: page.left + drop.x, top: page.top + drop.y, width: drop.width } : null);
      return { x: page.left + b.layout.x, y: page.top + py };
    }
    const i = pageAt(y + h / 2, boxes);
    const page = boxes[i];
    const others = blocks
      // (not to the blocks in its own text, which move with it)
      .filter((o) => o.id !== b.id && o.meta?.slot !== b.id && o.layout.pageId === pages[i].id)
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
    setLiftedId(null); // from now on its saved place in the stack (layout.z, raised by the move) keeps it on top
    const owner = b.meta?.slot ? blocks.find((o) => o.id === b.meta?.slot) : undefined;
    if (owner) {
      // In its box: it takes its new place in the text (or none), and the node goes back to its room until the page draws it there.
      const i = pageIndex.get(owner.layout.pageId) ?? 0;
      setSlotLine(null);
      props.onDragging?.(false);
      layerRef.current?.findOne(`#${b.id}`)?.position({ x: boxes[i].left + b.layout.x, y: boxes[i].top + b.layout.y });
      props.onMove?.(b.id, owner.layout.pageId, b.layout.x, y - boxes[i].top);
      return;
    }
    const i = pageAt(y + (heights.get(b.id) ?? 0) / 2, boxes);
    setSnap(null);
    setDragAt(null);
    props.onDragging?.(false);
    props.onMove?.(b.id, pages[i].id, x - boxes[i].left, y - boxes[i].top);
  };

  // The same drag, for a block moved from outside the stage.
  useImperativeHandle(props.mover, () => ({
    move: (id, x, y) => {
      const b = blocks.find((o) => o.id === id);
      return b ? handleDragMove(b, x, y) : { x, y };
    },
    end: (id, x, y) => {
      const b = blocks.find((o) => o.id === id);
      if (b) handleDragEnd(b, x, y);
    },
  }));

  // Resize end: keep the block inside its page; images/equations keep their shape.
  const handleResize = (b: Block, r: ResizeResult) => {
    const i = pageAt(r.y + r.height / 2, boxes);
    const page = boxes[i];
    const width = clamp(r.width, b.type === "shape" ? (isLine(b) ? 0 : MIN_SHAPE_SIZE) : 40, page.width);
    const ratio = b.type === "image" ? b.ratio : b.type === "equation" ? b.exW / Math.max(0.1, b.exH) : 0;
    const shape = b.type === "shape";
    const graph = b.type === "graph" || b.type === "textbox" || shape; // graphs, text boxes and shapes can change shape freely
    const h = graph ? clamp(r.height, b.type === "textbox" ? 30 : shape ? (isLine(b) ? 0 : MIN_SHAPE_SIZE) : 80, page.height) : ratio ? width / ratio : (heights.get(b.id) ?? 0);
    // (an image's caption sits under its picture: keep it on the page too)
    const below = b.type === "image" ? Math.max(0, (heights.get(b.id) ?? 0) - b.layout.height) : 0;
    props.onResize?.(b.id, {
      pageId: pages[i].id,
      x: clamp(r.x - page.left, 0, page.width - width),
      y: clamp(r.y - page.top, 0, page.height - h - below),
      width,
      ...(ratio || graph ? { height: h } : {}),
    });
  };

  // Text box tool: a crosshair over the pages. Leaving the tool (Escape, another tool) drops a box
  // being drawn; so does closing the page.
  useEffect(() => {
    const container = layerRef.current?.getStage()?.container();
    if (container) {
      container.style.cursor = inking && props.ink ? inkCursor(props.ink, zoom) : props.eraser && erasing ? eraserCursor(props.eraser.size) : drawing ? "crosshair" : "";
      container.style.touchAction = inking || erasing ? "none" : ""; // (a pen or a finger draws / rubs instead of scrolling)
    }
    if (!drawing && !erasing) stopDraw.current?.();
  }, [drawing, erasing, inking, props.ink, props.eraser, zoom]);
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
      const inX = (v: number) => clamp(v, box.left, box.left + box.width);
      const inY = (v: number) => clamp(v, box.top, box.top + box.height);
      let x1 = inX(p.x);
      let y1 = inY(p.y);
      const kind = drawShape.current;
      if (e.shiftKey && kind) {
        const dx = x1 - d.x0;
        const dy = y1 - d.y0;
        if (kind === "line") {
          const len = Math.hypot(dx, dy);
          const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          x1 = inX(d.x0 + Math.cos(step) * len);
          y1 = inY(d.y0 + Math.sin(step) * len);
        } else {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          x1 = inX(d.x0 + Math.sign(dx || 1) * side);
          y1 = inY(d.y0 + Math.sign(dy || 1) * side);
        }
      }
      d = { ...d, x1, y1 };
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
      const kind = drawShape.current;
      if (kind) {
        // a shape: a click puts it at its usual size, where the mouse is
        const click = kind === "line" ? Math.hypot(r.width, r.height) < 10 : r.width < 8 && r.height < 8;
        onDrawBox.current?.(click ? { pageIndex: page, x: d.x0 - box.left, y: d.y0 - box.top, width: 0, height: 0 } : { pageIndex: page, x: r.x - box.left, y: r.y - box.top, width: r.width, height: r.height, flipX: d.x1 < d.x0, flipY: d.y1 < d.y0 });
        return;
      }
      if (r.width < MIN_DRAWN.width || r.height < MIN_DRAWN.height) return;
      onDrawBox.current?.({ pageIndex: page, x: r.x - box.left, y: r.y - box.top, width: r.width, height: r.height });
    };
    window.addEventListener("mousemove", follow);
    window.addEventListener("mouseup", release);
    stopDraw.current = stop;
  };

  // Mouse (pen, finger) down on a page with a drawing tool: the stroke follows the pointer within that page, steadied as it goes
  // (InkCapture), shown as it will be, and handed over when let go.
  const startInk = (stage: Konva.Stage, x: number, y: number, t: number) => {
    const hand = ink.current;
    if (!hand) return;
    const page = pageAt(y, boxes);
    const box = boxes[page];
    const capture = new InkCapture(x, y, hand.smoothing, zoomRef.current, t);
    const at = (e: PointerEvent) => {
      stage.setPointersPositions(e);
      const p = stage.getPointerPosition();
      return p && { x: clamp(p.x, box.left, box.left + box.width), y: clamp(p.y, box.top, box.top + box.height) };
    };
    let frame = 0;
    const show = () => {
      frame = 0;
      liveInk.current?.({ ...hand, points: finishInk(capture.points, hand.tool, hand.smoothing) });
    };
    const follow = (e: PointerEvent) => {
      // every position the pointer went through since the last event (a fast stroke stays round, not made of corners)
      const all = e.getCoalescedEvents?.() ?? [];
      for (const c of all.length ? all : [e]) {
        const p = at(c);
        if (p) capture.add(p.x, p.y, c.timeStamp, c.pointerType === "pen" ? c.pressure : undefined);
      }
      if (!frame) frame = requestAnimationFrame(show);
    };
    const stop = () => {
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      cancelAnimationFrame(frame);
      stopDraw.current = null;
      liveInk.current?.(null);
    };
    const release = (e: PointerEvent) => {
      const p = at(e);
      if (p) capture.end(p.x, p.y);
      stop();
      const points = finishInk(capture.points, hand.tool, hand.smoothing).map((q) => ({ ...q, x: q.x - box.left, y: q.y - box.top }));
      const { tool, ...settings } = hand;
      if (points.length) onInk.current?.({ pageIndex: page, tool, settings, points });
    };
    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    stopDraw.current = stop;
    show();
  };

  // The eraser down on a page, until it is let go (one step of the undo). The real eraser rubs out the parts of the drawings it goes
  // over: the way it went on the page is handed over at each move. The stroke eraser takes whole drawings and shapes: what is drawn
  // under it (the shape blocks catch the mouse then, the others let it through).
  const startErase = (stage: Konva.Stage, e: PointerEvent, how: EraserSettings) => {
    const key = `erase:${Date.now()}`;
    const radius = how.size / 2 / zoomRef.current; // (page px: the tip keeps its size on the screen)
    const erasable = new Set(blocks.filter((b) => b.type === "shape").map((b) => b.id));
    const gone = new Set<string>();
    let last: { x: number; y: number } | null = null;
    const rub = (ev: PointerEvent) => {
      stage.setPointersPositions(ev);
      const p = stage.getPointerPosition();
      if (!p) return;
      const from = last ?? p;
      last = p;
      if (how.mode === "partial") {
        const i = pageAt(p.y, boxes);
        const box = boxes[i];
        const path = [from, p].map((q) => ({ x: q.x - box.left, y: q.y - box.top }));
        onEraseInk.current?.(pages[i].id, path, radius, key);
        return;
      }
      const before = gone.size;
      for (const q of eraserPoints(from, p, radius)) {
        const id = stage.getIntersection(q)?.findAncestor((n: Konva.Node) => erasable.has(n.id()), true)?.id();
        if (id) gone.add(id);
      }
      if (gone.size > before) onErase.current?.([...gone], key);
    };
    const stop = () => {
      window.removeEventListener("pointermove", rub);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      stopDraw.current = null;
    };
    window.addEventListener("pointermove", rub);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    stopDraw.current = stop;
    rub(e);
  };

  // A table with shapes or pictures is fixed like a picture: corner handles, in its own proportions.
  const media = selected?.type === "image" || selected?.type === "equation" || (selected?.type === "table" && isFixedTable(selected));
  const corners = media || selected?.type === "graph";
  const freeBox = selected?.type === "textbox" || selected?.type === "shape"; // a text box or a shape: every side and corner

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      // Clicking empty paper clears the selection (with the T tool: starts a new text there; with the
      // text box tool: starts drawing a box, blocks let the mouse through then).
      // A drawing tool starts its stroke on pointer down (a mouse, a pen with its pressure, or a finger).
      onPointerDown={(e) => {
        if (erasing && e.evt.button === 0) {
          e.evt.preventDefault(); // (no text selection while rubbing)
          props.onSelect?.(null);
          const stage = e.target.getStage();
          if (stage && props.eraser) startErase(stage, e.evt, props.eraser);
          return;
        }
        if (!inking || e.evt.button !== 0 || e.target.name() !== "paper") return;
        const stage = e.target.getStage();
        stage?.setPointersPositions(e.evt);
        const p = stage?.getPointerPosition();
        if (stage && p) startInk(stage, p.x, p.y, e.evt.timeStamp);
      }}
      onMouseDown={(e) => {
        if (e.target !== e.target.getStage() && e.target.name() !== "paper") return;
        props.onSelect?.(null);
        const stage = e.target.getStage();
        const p = stage?.getPointerPosition();
        if (inking) {
          e.evt.preventDefault(); // (the stroke started on pointer down) no text selection while drawing
        } else if (drawing && stage && p && e.target.name() === "paper" && e.evt.button === 0) {
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

        {/* One list (keys kept), so a block that becomes selected keeps its node: a drag started on it goes on */}
        {[
          ...shown.flatMap((b) => (ghostIds.has(b.id) ? (raised ? [] : [{ b, passive: true }]) : [{ b, passive: false }])),
          ...shown.filter((b) => ghostIds.has(b.id)).map((b) => ({ b, passive: false })),
        ].map(({ b, passive }) => (
          <BlockNode
            key={passive ? `passive:${b.id}` : b.id}
            passive={passive}
            ghost={!passive && ghostIds.has(b.id) && !raised}
            hovered={passive && ghostHover}
            onHover={ghostIds.has(b.id) && !passive ? setGhostHover : undefined}
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
            drawing={drawing || erasing}
            erasable={erasing && props.eraser?.mode === "stroke" && b.type === "shape"}
            typing={b.id === props.typingId}
            onSelect={(alt) => pick(b, !!alt)}
            onDragStart={() => handleDragStart(b)}
            onEdit={(field) => props.onEdit?.(b.id, field)}
            onPatch={(patch) => props.onPatch?.(b.id, patch)}
            onDragMove={(x, y) => handleDragMove(b, x, y)}
            onDragEnd={(x, y) => handleDragEnd(b, x, y)}
            onResize={(r) => handleResize(b, r)}
            onResizing={(r) => {
              setResizingId(r ? b.id : null);
              props.onResizing?.(b.id, r);
            }}
          />
        ))}

        {/* While the margins are edited: the area outside them is shaded (over the blocks; clicks go through it) */}
        {preview && pages.map((page, i) => <MarginShade key={page.id} box={boxes[i]} margins={preview} instant={!!edit?.dragging} />)}
        {preview &&
          pages.map((page, i) => (
            <MarginHandles key={page.id} box={boxes[i]} margins={preview} zoom={zoom} onDrag={(m, done) => props.onMarginDrag?.(m, done)} />
          ))}

        {/* The text box being drawn */}
        {draft && props.drawShape === "line" && <Line points={[draft.x0, draft.y0, draft.x1, draft.y1]} stroke={ACCENT} strokeWidth={1.5 / zoom} dash={[4 / zoom, 4 / zoom]} listening={false} />}
        {draft && props.drawShape !== "line" && (
          <Rect
            {...draftRect(draft)}
            fill="rgba(0,0,0,0.05)"
            stroke={ACCENT}
            strokeWidth={1 / zoom}
            dash={[4 / zoom, 4 / zoom]}
            listening={false}
          />
        )}

        {/* Where the block dragged in its text box would go */}
        {slotLine && (
          <Line points={[slotLine.left, slotLine.top, slotLine.left + slotLine.width, slotLine.top]} stroke={SNAP_COLOR} strokeWidth={2.5 / zoom} lineCap="round" listening={false} />
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
      {/* the stroke being drawn (a layer of its own: only it is redrawn while the pointer moves) */}
      {inking && (
        <Layer ref={inkLayerRef} listening={false}>
          <LiveStroke bindRef={liveInk} layer={inkLayerRef} />
        </Layer>
      )}
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

// The stroke being drawn, with the tool that draws it (stage pixels).
type LiveInk = InkInHand & { points: InkPoint[] };

// The stroke being drawn: the canvas hands it over through `bind` at each frame, so the page's blocks are not redrawn meanwhile.
// A highlighter's layer darkens what is under it, like the stroke once it is on the page.
function LiveStroke({ bindRef, layer }: { bindRef: RefObject<((s: LiveInk | null) => void) | null>; layer: RefObject<Konva.Layer | null> }) {
  const [live, setLive] = useState<LiveInk | null>(null);
  useEffect(() => {
    bindRef.current = setLive;
    return () => {
      bindRef.current = null;
    };
  }, [bindRef]);
  useEffect(() => {
    const el = layer.current?.getCanvas()._canvas;
    if (el) el.style.mixBlendMode = live?.tool === "highlighter" ? "multiply" : "";
  }, [layer, live?.tool]);
  if (!live || live.points.length < 1) return null;
  return <InkStroke tool={live.tool} points={live.points} color={live.color} size={live.size} />;
}

// The pointer of a drawing tool: a ring the size of the stroke on screen (a small cross in it when that is tiny).
function inkCursor(hand: InkInHand, zoom: number) {
  const d = Math.max(4, Math.min(64, Math.round(hand.size * zoom)));
  const s = d + 4;
  const c = s / 2;
  const cross = d < 10 ? `<path d='M${c} ${c - 5}v10M${c - 5} ${c}h10' stroke='white' stroke-width='3'/><path d='M${c} ${c - 5}v10M${c - 5} ${c}h10' stroke='black' stroke-width='1'/>` : "";
  const ring = `<circle cx='${c}' cy='${c}' r='${d / 2}' fill='none' stroke='white' stroke-width='2.5'/><circle cx='${c}' cy='${c}' r='${d / 2}' fill='none' stroke='black' stroke-width='1'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>${ring}${cross}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}

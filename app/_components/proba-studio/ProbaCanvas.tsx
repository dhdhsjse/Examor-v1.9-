"use client";

import type Konva from "konva";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Circle, Group, Layer, Line, Path, Rect, Shape, Stage, Text } from "react-konva";
import TableDrawingLayer, { type TableTool } from "@/app/_components/table-studio/TableDrawingLayer";
import type { EraserTool } from "@/app/_lib/ink/useEraserTool";
import type { InkTools } from "@/app/_lib/ink/useInkTools";
import { newItem } from "@/app/_lib/proba/ops";
import { FONT, INK, drawItem, shift, type Circ, type Hit, type Prim } from "@/app/_lib/proba/scene";
import { findNode } from "@/app/_lib/proba/tree";
import type { ProbNode, ProbTree } from "@/app/_lib/proba/types";
import type { ShapeStyle } from "@/app/_lib/shapes";
import { useT } from "@/app/_lib/uiLang";
import { isPlaceTool, type ProbaStudioState } from "./useProbaStudio";

const AREA_PADDING = 16; // (the p-4 around the sheet)
const ACCENT = "#4f46e5";
const HOVER = "#6366f1"; // a part of a tree under the mouse
const PICKED = "#4338ca"; // the selected event and its branch
const GRID = 20;
const TEXT_BOX = 600; // a text is laid out in a box this wide, aligned inside it
/** The zoom steps of the − and + buttons (and Ctrl + the wheel) */
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 2.5, 3];

const setCursor = (value: string) => (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => {
  const box = e.target.getStage()?.container();
  if (box) box.style.cursor = value;
};

/** A region of a Venn diagram, shaded: clipped to each circle it is in, with the circles it is out of cut away. */
function Region({ inside, outside, frame, fill }: { inside: Circ[]; outside: Circ[]; frame: { x: number; y: number; w: number; h: number }; fill: string }) {
  const rect = <Shape listening={false} fill={fill} sceneFunc={(ctx, shape) => {
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    // (each circle the region is out of, drawn the other way round: a hole)
    for (const c of outside) {
      ctx.moveTo(c.cx + c.r, c.cy);
      ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2, true);
    }
    ctx.fillShape(shape);
  }} />;
  return inside.reduceRight<ReactNode>(
    (child, c) => (
      <Group listening={false} clipFunc={(ctx) => { ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2, false); }}>
        {child}
      </Group>
    ),
    rect,
  ) as ReactElement;
}

/** The prims of the scene as Konva nodes. `color` draws them all in one color (a ghost); `colors` colors the parts of a tree by owner. */
export function Prims({ prims, color, colors, opacity = 1 }: { prims: Prim[]; color?: string; colors?: Record<string, string>; opacity?: number }) {
  return (
    <Group opacity={opacity} listening={false}>
      {prims.map((p, i) => {
        const tint = color ?? (p.owner ? colors?.[p.owner] : undefined);
        switch (p.k) {
          case "line":
            return <Line key={i} points={p.pts} stroke={tint ?? p.color ?? INK} strokeWidth={tint && !color ? p.w * 1.6 : p.w} dash={p.dash} closed={p.closed} fill={p.fill ? (tint ?? p.fill) : undefined} lineCap="round" lineJoin="round" />;
          case "circle":
            return <Circle key={i} x={p.cx} y={p.cy} radius={p.r} fill={p.fill && tint && p.fill === INK ? tint : p.fill} stroke={p.stroke ? (tint ?? p.stroke) : undefined} strokeWidth={p.w ?? 1.5} />;
          case "rect":
            return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} cornerRadius={p.radius} fill={p.fill} stroke={p.stroke ? (tint ?? p.stroke) : undefined} strokeWidth={p.sw ?? 1.5} />;
          case "path":
            return <Path key={i} data={p.d} fill={p.fill} stroke={p.stroke ? (tint ?? p.stroke) : undefined} strokeWidth={p.w ?? 1.5} lineJoin="round" lineCap="round" />;
          case "text":
            return (
              <Text
                key={i}
                text={p.text}
                x={p.x - (p.anchor === "start" ? 0 : p.anchor === "middle" ? TEXT_BOX / 2 : TEXT_BOX)}
                y={p.y - p.size}
                width={TEXT_BOX}
                height={2 * p.size}
                align={p.anchor === "start" ? "left" : p.anchor === "middle" ? "center" : "right"}
                verticalAlign="middle"
                wrap="none"
                fontFamily={FONT}
                fontSize={p.size}
                fontStyle={`${p.italic ? "italic " : ""}${p.bold || (tint && !color) ? "bold" : "normal"}`}
                fill={tint ?? p.color ?? INK}
              />
            );
          case "region":
            return <Region key={i} inside={p.inside} outside={p.outside} frame={p.frame} fill={p.fill} />;
        }
      })}
    </Group>
  );
}

// The dot grid of the sheet, in one path.
function DotGrid({ width, height }: { width: number; height: number }) {
  return (
    <Shape
      listening={false}
      fill="#d6dbe4"
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        for (let x = GRID; x < width; x += GRID) for (let y = GRID; y < height; y += GRID) ctx.rect(x - 0.7, y - 0.7, 1.4, 1.4);
        ctx.fillShape(shape);
      }}
    />
  );
}

/** The event being typed on the sheet. */
type Inline = { tree: string; node: string };

/** The nodes of a tree in reading order (the next one Tab goes to). */
const readingOrder = (root: ProbNode): ProbNode[] => [root, ...root.children.flatMap(readingOrder)];

/** The part of a tree a hit belongs to (what the mouse over it colors). */
const ownerOf = (h: Hit) => `${h.node}:${h.part === "node" ? "node" : "branch"}`;

// The sheet of the Probability Studio on a Konva stage: a white sheet with a faint dot grid and everything on it, drawn from the
// scene of _lib/proba/scene.ts (the same one the picture for the page is made from). It fits the window by default and can be
// zoomed (the − / + buttons, Ctrl + the wheel, Ctrl + = / − / 0). With the Select tool a click selects an item (an event or a
// branch of a tree, too: each lights up under the mouse) and a drag moves it; a double-click on an event types it right there, on
// a probability it goes to its field in the right panel; the round + of the selected event adds a branch. With a tile of the left
// panel in hand, a ghost shows where it goes and a click puts it. The drawings of the floating bar are on a layer over it.
export default function ProbaCanvas({ studio, ink, eraser, inlineRequest, onInlineDone }: {
  studio: ProbaStudioState;
  ink: InkTools;
  eraser: EraserTool;
  /** Start typing an event on the sheet (F2) */
  inlineRequest: Inline | null;
  onInlineDone: () => void;
}) {
  const t = useT();
  const { config, tool, selection, selectedTree } = studio;
  const box = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [dragVersion, setDragVersion] = useState(0); // (a dragged node is put back where the state says it is, by making a new one)
  const [inline, setInline] = useState<Inline | null>(null);
  const [hover, setHover] = useState<{ item: string; owner: string } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); // null: fit the window
  const drawn = useMemo(() => config.items.map((it) => ({ item: it, d: drawItem(it) })), [config.items]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a request from the Studio (F2) starts the typing (state adjusted while rendering, not in an effect)
  const [request, setRequest] = useState(inlineRequest);
  if (inlineRequest !== request) {
    setRequest(inlineRequest);
    if (inlineRequest) setInline(inlineRequest);
  }

  // (one field for all the typing on the sheet: Tab moves it to the next event, which is selected to be typed over)
  const inlineRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [inline?.node]);

  // ---- zoom ----

  const fit = area.w > 0 && area.h > 0 ? Math.min(1, (area.w - 2 * AREA_PADDING) / config.width, (area.h - 2 * AREA_PADDING) / config.height) : 1;
  const scale = zoom ?? Math.max(0.1, fit);
  const percent = Math.round(scale * 100);
  const zoomBy = (dir: 1 | -1) =>
    setZoom((z) => {
      const now = z ?? Math.max(0.1, fit);
      const next = dir > 0 ? ZOOMS.find((s) => s > now + 0.001) : [...ZOOMS].reverse().find((s) => s < now - 0.001);
      return next ?? now;
    });
  const zoomRef = useRef(zoomBy);
  useEffect(() => {
    zoomRef.current = zoomBy;
  });

  // Ctrl + the wheel zooms the sheet (not the page); Ctrl + = / − / 0 too, when not typing
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomRef.current(e.deltaY < 0 ? 1 : -1);
    };
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (e.key === "=" || e.key === "+") zoomRef.current(1);
      else if (e.key === "-") zoomRef.current(-1);
      else if (e.key === "0") setZoom(null);
      else return;
      e.preventDefault();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, []);

  // ---- tools ----

  const placing = isPlaceTool(tool) ? tool : null;
  const selecting = tool === "select";
  const ghost = useMemo(() => {
    if (!placing || !pointer) return null;
    const d = drawItem(newItem(placing, 0, 0));
    return d.prims.map((p) => shift(p, pointer.x - d.bounds.w / 2, pointer.y - d.bounds.h / 2));
  }, [placing, pointer]);

  const paperPoint = (stage: Konva.Stage | null) => {
    const p = stage?.getPointerPosition();
    return p ? { x: p.x / scale, y: p.y / scale } : null;
  };

  const onBackgroundClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const p = paperPoint(e.target.getStage());
    if (!p) return;
    if (placing) studio.placeItem(placing, p.x, p.y);
    else studio.clearSelection();
  };

  // ---- typing an event on the sheet ----

  const inlineTree = inline ? (config.items.find((i) => i.id === inline.tree) as ProbTree | undefined) : undefined;
  const inlineNode = inline && inlineTree?.kind === "tree" ? findNode(inlineTree.root, inline.node) : null;
  const inlineBox = inline ? drawn.find((x) => x.item.id === inline.tree)?.d.hits.find((h) => h.node === inline.node && h.part === "node") : undefined;

  const nextInline = (back: boolean) => {
    if (!inline || !inlineTree) return;
    const order = readingOrder(inlineTree.root);
    const next = order[order.findIndex((n) => n.id === inline.node) + (back ? -1 : 1)];
    if (!next) return closeInline();
    setInline({ tree: inline.tree, node: next.id });
    studio.selectItem(inline.tree, next.id);
  };
  const closeInline = () => {
    setInline(null);
    onInlineDone();
  };

  // A double-click: an event is typed where it is; a probability goes to its field in the right panel.
  const onHitDouble = (treeId: string, h: Hit) => {
    studio.selectItem(treeId, h.node);
    if (h.part === "node") return setInline({ tree: treeId, node: h.node });
    setTimeout(() => {
      const field = document.querySelector<HTMLInputElement>('[data-testid="node-prob"]');
      field?.focus();
      field?.select();
    }, 30);
  };

  const width = config.width * scale;
  const height = config.height * scale;
  const dockTool: TableTool = isPlaceTool(tool) ? "select" : tool;
  const textStyle = useMemo<Partial<ShapeStyle>>(() => ({ fontSize: 16, textAlign: "left", textVAlign: "top" }), []);
  const zoomButton = "grid size-7 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";

  return (
    <div className="relative flex min-h-0 flex-1">
      <div ref={box} data-testid="proba-canvas" className="min-h-0 flex-1 overflow-auto bg-canvas">
        <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: "max-content", height: "max-content" }}>
          <div dir="ltr" className="relative shrink-0 outline outline-line" style={{ width, height, cursor: placing ? "crosshair" : undefined }} aria-label={t("Probability drawing area")} role="img">
            <Stage
              width={width}
              height={height}
              scaleX={scale}
              scaleY={scale}
              onMouseMove={(e) => {
                if (!placing) return;
                const p = paperPoint(e.target.getStage());
                if (p) setPointer(p);
              }}
              onMouseLeave={() => {
                setPointer(null);
                setHover(null);
              }}
            >
              <Layer>
                <Rect width={config.width} height={config.height} fill="#ffffff" onClick={onBackgroundClick} />
                <DotGrid width={config.width} height={config.height} />

                {drawn.map(({ item, d }) => {
                  const isSelected = selection?.kind === "item" && selection.id === item.id;
                  const node = isSelected && selection?.kind === "item" ? selection.node : undefined;
                  const tree = item.kind === "tree" ? item : null;
                  const nodeHit = node ? d.hits.find((h) => h.node === node && h.part === "node") : undefined;
                  // the selected event and its branch in a darker color, the part under the mouse in a lighter one
                  const colors: Record<string, string> = {};
                  if (node) {
                    colors[`${node}:node`] = PICKED;
                    colors[`${node}:branch`] = PICKED;
                  }
                  if (hover?.item === item.id && selecting) colors[hover.owner] = HOVER;
                  return (
                    <Group
                      key={`${item.id}-${dragVersion}`}
                      draggable={selecting}
                      onDragStart={(e) => {
                        studio.selectItem(item.id, node);
                        setCursor("grabbing")(e);
                      }}
                      onDragEnd={(e) => {
                        studio.moveItem(item.id, item.x + e.target.x(), item.y + e.target.y());
                        setDragVersion((v) => v + 1);
                      }}
                      onClick={(e) => {
                        if (e.evt.button !== 0 || !selecting) return;
                        e.cancelBubble = true;
                        studio.selectItem(item.id);
                      }}
                      onMouseEnter={(e) => selecting && setCursor("move")(e)}
                      onMouseLeave={(e) => setCursor("")(e)}
                    >
                      {/* what can be grabbed: the whole box of the item */}
                      <Rect x={d.bounds.x - 4} y={d.bounds.y - 4} width={d.bounds.w + 8} height={d.bounds.h + 8} fill="transparent" listening={selecting} />
                      {isSelected && <Rect x={d.bounds.x - 6} y={d.bounds.y - 6} width={d.bounds.w + 12} height={d.bounds.h + 12} stroke={ACCENT} strokeWidth={1.2 / scale} dash={[5 / scale, 4 / scale]} cornerRadius={4} listening={false} />}
                      {nodeHit && <Rect x={nodeHit.box.x} y={nodeHit.box.y} width={nodeHit.box.w} height={nodeHit.box.h} fill="rgba(79,70,229,0.10)" cornerRadius={5} listening={false} />}
                      <Prims prims={d.prims} colors={colors} />

                      {/* a tree: each event, each branch and each probability lights up under the mouse; a click selects that branch */}
                      {tree &&
                        selecting &&
                        d.hits.map((h) => {
                          const events = {
                            onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
                              if (e.evt.button !== 0) return;
                              e.cancelBubble = true;
                              studio.selectItem(item.id, h.node);
                            },
                            onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
                              e.cancelBubble = true;
                              onHitDouble(item.id, h);
                            },
                            onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
                              setHover({ item: item.id, owner: ownerOf(h) });
                              setCursor("pointer")(e);
                            },
                            onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => {
                              setHover((x) => (x?.owner === ownerOf(h) ? null : x));
                              setCursor("move")(e);
                            },
                          };
                          return h.pts ? (
                            <Line key={`${h.node}-${h.part}`} points={h.pts} stroke="transparent" strokeWidth={1} hitStrokeWidth={12 / scale} {...events} />
                          ) : (
                            <Rect key={`${h.node}-${h.part}`} x={h.box.x} y={h.box.y} width={h.box.w} height={h.box.h} fill="transparent" {...events} />
                          );
                        })}

                      {/* the + of the selected event: a new branch after it (selected, ready for another +) */}
                      {tree && nodeHit && selecting && (
                        <Group
                          x={tree.direction === "right" ? nodeHit.box.x + nodeHit.box.w + 12 / scale : nodeHit.box.x + nodeHit.box.w / 2}
                          y={tree.direction === "right" ? nodeHit.box.y + nodeHit.box.h / 2 : nodeHit.box.y + nodeHit.box.h + 12 / scale}
                          scaleX={1 / scale}
                          scaleY={1 / scale}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            if (e.evt.button !== 0) return;
                            studio.branch(tree.id, nodeHit.node);
                          }}
                          onMouseEnter={(e) => setCursor("pointer")(e)}
                          onMouseLeave={(e) => setCursor("move")(e)}
                        >
                          <Circle radius={10} fill={ACCENT} />
                          <Line points={[-5, 0, 5, 0]} stroke="#ffffff" strokeWidth={2} lineCap="round" listening={false} />
                          <Line points={[0, -5, 0, 5]} stroke="#ffffff" strokeWidth={2} lineCap="round" listening={false} />
                        </Group>
                      )}
                    </Group>
                  );
                })}

                {ghost && <Prims prims={ghost} color={ACCENT} opacity={0.45} />}
              </Layer>
            </Stage>

            {/* the drawings, shapes and text boxes of the floating bar, over the sheet */}
            {/* (the wrapper lets the mouse through: the layer itself takes it only with a drawing tool or over a drawing) */}
            <div className="pointer-events-none absolute left-0 top-0">
              <TableDrawingLayer
                width={config.width}
                rowsHeight={config.height}
                roomBelow={0}
                scale={scale}
                shapes={config.shapes ?? []}
                tool={dockTool}
                shapeKind={studio.shapeKind}
                ink={ink}
                textStyle={textStyle}
                selectedId={studio.selectedShape?.id ?? null}
                editingId={studio.textId}
                onSelect={studio.selectShape}
                onChange={studio.changeShape}
                onAdd={studio.addDrawing}
                eraser={eraser}
                onErase={studio.eraseShapes}
                onEraseInk={studio.eraseInk}
                onEdit={studio.editText}
              />
            </div>

            {/* typing an event right on the tree */}
            {inline && inlineNode && inlineBox && (
              <input
                ref={inlineRef}
                autoFocus
                data-testid="proba-inline"
                dir="auto"
                value={inlineNode.label}
                placeholder={t("Event")}
                onChange={(e) => studio.setNode(inline.tree, inline.node, { label: e.target.value })}
                onBlur={closeInline}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" || e.key === "Escape") {
                    e.preventDefault();
                    closeInline();
                  } else if (e.key === "Tab") {
                    e.preventDefault();
                    nextInline(e.shiftKey);
                  }
                }}
                className="absolute rounded border border-accent bg-white px-1 text-center text-ink outline-none"
                style={{
                  left: (inlineBox.box.x + inlineBox.box.w / 2) * scale - Math.max(56, inlineBox.box.w * scale + 16) / 2,
                  top: (inlineBox.box.y + inlineBox.box.h / 2) * scale - 15,
                  width: Math.max(56, inlineBox.box.w * scale + 16),
                  height: 30,
                  fontSize: Math.max(13, Math.min(18, (selectedTree?.fontSize ?? 16) * scale)),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* zoom: − , the percent (a click fits the window), + */}
      <div data-testid="proba-zoom" className="absolute end-2 top-2 z-20 flex items-center rounded border border-line bg-white" dir="ltr">
        <button onClick={() => zoomBy(-1)} disabled={scale <= ZOOMS[0] + 0.001} className={zoomButton} title={`${t("Zoom out")} (Ctrl −)`} aria-label={t("Zoom out")} data-testid="zoom-out">
          <Minus size={14} />
        </button>
        <button onClick={() => setZoom(zoom === null ? 1 : null)} className="h-7 min-w-12 px-1 text-xs tabular-nums text-ink hover:bg-hover" title={zoom === null ? t("Show at 100%") : `${t("Fit to window")} (Ctrl 0)`} data-testid="zoom-value">
          {percent}%
        </button>
        <button onClick={() => zoomBy(1)} disabled={scale >= ZOOMS[ZOOMS.length - 1] - 0.001} className={zoomButton} title={`${t("Zoom in")} (Ctrl +)`} aria-label={t("Zoom in")} data-testid="zoom-in">
          <Plus size={14} />
        </button>
        <span aria-hidden className="h-4 w-px bg-line" />
        <button onClick={() => setZoom(null)} aria-pressed={zoom === null} className={`${zoomButton} ${zoom === null ? "text-accent-strong" : ""}`} title={`${t("Fit to window")} (Ctrl 0)`} aria-label={t("Fit to window")} data-testid="zoom-fit">
          <Maximize2 size={13} />
        </button>
      </div>
    </div>
  );
}

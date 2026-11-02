"use client";

import type Konva from "konva";
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

const AREA_PADDING = 24;
const MIN_SCALE = 0.1;
const ACCENT = "#4f46e5";
const GRID = 20;
const TEXT_BOX = 600; // a text is laid out in a box this wide, aligned inside it

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

/** The prims of the scene as Konva nodes. */
export function Prims({ prims, color, opacity = 1 }: { prims: Prim[]; color?: string; opacity?: number }) {
  return (
    <Group opacity={opacity} listening={false}>
      {prims.map((p, i) => {
        switch (p.k) {
          case "line":
            return <Line key={i} points={p.pts} stroke={color ?? p.color ?? INK} strokeWidth={p.w} dash={p.dash} closed={p.closed} fill={p.fill ? (color ?? p.fill) : undefined} lineCap="round" lineJoin="round" />;
          case "circle":
            return <Circle key={i} x={p.cx} y={p.cy} radius={p.r} fill={p.fill} stroke={p.stroke ? (color ?? p.stroke) : undefined} strokeWidth={p.w ?? 1.5} />;
          case "rect":
            return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} cornerRadius={p.radius} fill={p.fill} stroke={p.stroke ? (color ?? p.stroke) : undefined} strokeWidth={p.sw ?? 1.5} />;
          case "path":
            return <Path key={i} data={p.d} fill={p.fill} stroke={p.stroke ? (color ?? p.stroke) : undefined} strokeWidth={p.w ?? 1.5} lineJoin="round" lineCap="round" />;
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
                fontStyle={`${p.italic ? "italic " : ""}${p.bold ? "bold" : "normal"}`}
                fill={color ?? p.color ?? INK}
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

/** What is being typed on the sheet: the event of a node, or the probability of its branch. */
type Inline = { tree: string; node: string; part: "node" | "prob" };

/** The nodes of a tree in reading order (the next one Tab goes to). */
const readingOrder = (root: ProbNode): ProbNode[] => [root, ...root.children.flatMap(readingOrder)];

// The sheet of the Probability Studio on a Konva stage: a white sheet with a faint dot grid and everything on it, drawn from the
// scene of _lib/proba/scene.ts (the same one the picture for the page is made from), shown smaller when it does not fit the
// window. With the Select tool a click selects an item (a node or a branch of a tree, too) and a drag moves it; a double-click
// on an event or a probability types it right there; the round + of the selected node adds a branch. With a tile of the left
// panel in hand, a ghost shows where it goes and a click puts it. The drawings of the floating bar are on a layer over it.
export default function ProbaCanvas({ studio, ink, eraser, inlineRequest, onInlineDone }: {
  studio: ProbaStudioState;
  ink: InkTools;
  eraser: EraserTool;
  /** Start typing on the sheet (a branch just added) */
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
  const drawn = useMemo(() => config.items.map((it) => ({ item: it, d: drawItem(it) })), [config.items]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a request from the Studio (a key that added a branch) starts the typing (state adjusted while rendering, not in an effect)
  const [request, setRequest] = useState(inlineRequest);
  if (inlineRequest !== request) {
    setRequest(inlineRequest);
    if (inlineRequest) setInline(inlineRequest);
  }

  // (one field for all the typing on the sheet: Tab moves it to the next text, which is selected to be typed over)
  const inlineRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [inline?.node, inline?.part]);

  const fit = area.w > 0 && area.h > 0 ? Math.min(1, (area.w - 2 * AREA_PADDING) / config.width, (area.h - 2 * AREA_PADDING) / config.height) : 1;
  const scale = Math.max(MIN_SCALE, fit);
  const percent = Math.round(scale * 100);

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

  // ---- typing on the sheet ----

  const inlineTree = inline ? (config.items.find((i) => i.id === inline.tree) as ProbTree | undefined) : undefined;
  const inlineNode = inline && inlineTree?.kind === "tree" ? findNode(inlineTree.root, inline.node) : null;
  const inlineHit = inline ? drawn.find((x) => x.item.id === inline.tree)?.d.hits.find((h) => h.node === inline.node && h.part === inline.part) : undefined;
  // the probability of the root has no place: typing it goes to the event
  const inlineBox = inlineHit ?? (inline ? drawn.find((x) => x.item.id === inline.tree)?.d.hits.find((h) => h.node === inline.node && h.part === "node") : undefined);

  const nextInline = (back: boolean) => {
    if (!inline || !inlineTree) return;
    const order = readingOrder(inlineTree.root).flatMap((n, i) => (i === 0 ? [{ node: n.id, part: "node" as const }] : [{ node: n.id, part: "node" as const }, { node: n.id, part: "prob" as const }]));
    const at = order.findIndex((o) => o.node === inline.node && o.part === inline.part);
    const next = order[at + (back ? -1 : 1)];
    if (!next) return closeInline();
    setInline({ tree: inline.tree, ...next });
    studio.selectItem(inline.tree, next.node);
  };
  const closeInline = () => {
    setInline(null);
    onInlineDone();
  };

  const startInline = (treeId: string, h: Hit) => {
    studio.selectItem(treeId, h.node);
    const tree = config.items.find((i) => i.id === treeId);
    const isRoot = tree?.kind === "tree" && tree.root.id === h.node;
    setInline({ tree: treeId, node: h.node, part: isRoot ? "node" : h.part });
  };

  const width = config.width * scale;
  const height = config.height * scale;
  const dockTool: TableTool = isPlaceTool(tool) ? "select" : tool;
  const textStyle = useMemo<Partial<ShapeStyle>>(() => ({ fontSize: 16, textAlign: "left", textVAlign: "top" }), []);

  return (
    <div ref={box} data-testid="proba-canvas" className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-subtle/60 p-4">
      <div dir="ltr" className="relative shadow-sm" style={{ width, height, cursor: placing ? "crosshair" : undefined }} aria-label={t("Probability drawing area")} role="img">
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
          onMouseLeave={() => setPointer(null)}
        >
          <Layer>
            <Rect width={config.width} height={config.height} fill="#ffffff" onClick={onBackgroundClick} />
            <DotGrid width={config.width} height={config.height} />

            {drawn.map(({ item, d }) => {
              const isSelected = selection?.kind === "item" && selection.id === item.id;
              const node = isSelected && selection?.kind === "item" ? selection.node : undefined;
              const tree = item.kind === "tree" ? item : null;
              const nodeHit = node ? d.hits.find((h) => h.node === node && h.part === "node") : undefined;
              const probHit = node ? d.hits.find((h) => h.node === node && h.part === "prob") : undefined;
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
                  {nodeHit && <Rect x={nodeHit.box.x} y={nodeHit.box.y} width={nodeHit.box.w} height={nodeHit.box.h} fill="rgba(79,70,229,0.12)" stroke={ACCENT} strokeWidth={1.2 / scale} cornerRadius={5} listening={false} />}
                  {probHit && <Rect x={probHit.box.x} y={probHit.box.y} width={probHit.box.w} height={probHit.box.h} stroke={ACCENT} strokeWidth={1 / scale} dash={[3 / scale, 3 / scale]} cornerRadius={4} listening={false} />}
                  <Prims prims={d.prims} />

                  {/* a tree: each event and each probability can be clicked (selects that branch) and double-clicked (types it) */}
                  {tree &&
                    selecting &&
                    d.hits.map((h) => (
                      <Rect
                        key={`${h.node}-${h.part}`}
                        x={h.box.x}
                        y={h.box.y}
                        width={h.box.w}
                        height={h.box.h}
                        fill="transparent"
                        onClick={(e) => {
                          if (e.evt.button !== 0) return;
                          e.cancelBubble = true;
                          studio.selectItem(item.id, h.node);
                        }}
                        onDblClick={(e) => {
                          e.cancelBubble = true;
                          startInline(item.id, h);
                        }}
                        onMouseEnter={(e) => setCursor("pointer")(e)}
                        onMouseLeave={(e) => setCursor("move")(e)}
                      />
                    ))}

                  {/* the + of the selected node: a new branch after it */}
                  {tree && nodeHit && selecting && (
                    <Group
                      x={tree.direction === "right" ? nodeHit.box.x + nodeHit.box.w + 12 / scale : nodeHit.box.x + nodeHit.box.w / 2}
                      y={tree.direction === "right" ? nodeHit.box.y + nodeHit.box.h / 2 : nodeHit.box.y + nodeHit.box.h + 12 / scale}
                      scaleX={1 / scale}
                      scaleY={1 / scale}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (e.evt.button !== 0) return;
                        const added = studio.branch(tree.id, nodeHit.node);
                        if (added) setInline({ tree: tree.id, node: added.id, part: "prob" });
                      }}
                      onMouseEnter={(e) => setCursor("pointer")(e)}
                      onMouseLeave={(e) => setCursor("move")(e)}
                    >
                      <Circle radius={10} fill={ACCENT} shadowColor="#000000" shadowOpacity={0.2} shadowBlur={3} />
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

        {/* typing an event or a probability right on the tree */}
        {inline && inlineNode && inlineBox && (
          <input
            ref={inlineRef}
            autoFocus
            data-testid="proba-inline"
            dir="auto"
            value={inline.part === "node" ? inlineNode.label : inlineNode.prob}
            placeholder={inline.part === "node" ? t("Event") : t("Probability")}
            onChange={(e) => studio.setNode(inline.tree, inline.node, inline.part === "node" ? { label: e.target.value } : { prob: e.target.value })}
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
            className="absolute rounded-md border-2 border-accent bg-white px-1 text-center text-ink shadow-md outline-none"
            style={{
              left: (inlineBox.box.x + inlineBox.box.w / 2) * scale - Math.max(64, inlineBox.box.w * scale + 16) / 2,
              top: (inlineBox.box.y + inlineBox.box.h / 2) * scale - 15,
              width: Math.max(64, inlineBox.box.w * scale + 16),
              height: 30,
              fontSize: Math.max(13, Math.min(18, (selectedTree?.fontSize ?? 16) * scale)),
            }}
          />
        )}
      </div>
      {percent < 100 && (
        <p data-testid="proba-scale-note" className="absolute bottom-2 start-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-muted shadow-sm">
          {t("The drawing is shown at {percent}% to fit the window.", { percent })}
        </p>
      )}
    </div>
  );
}

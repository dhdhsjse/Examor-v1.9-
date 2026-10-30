"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import { GRID, routeNext, snapTarget, type P } from "@/app/_lib/circuit/geometry";
import { JUNCTION_RADIUS, WIRE_STROKE, buildCircuitScene } from "@/app/_lib/circuit/scene";
import { SYMBOL_STROKE, drawComponent, type SymbolShape } from "@/app/_lib/circuit/symbols";
import { INK } from "@/app/_lib/circuit/svg";
import type { ComponentType } from "@/app/_lib/circuit/types";
import { newComponent } from "@/app/_lib/circuit/ops";
import ShapeDrawSurface from "@/app/_components/shapes/ShapeDrawSurface";
import StudioShapes from "@/app/_components/shapes/StudioShapes";
import { useT } from "@/app/_lib/uiLang";
import type { CircuitStudioState } from "./useCircuitStudio";

const FONT = "Arial, Helvetica, sans-serif";
const TEXT_BOX = 160; // a text is laid out in a box this wide, aligned inside it
const AREA_PADDING = 24;
const MIN_SCALE = 0.1;
const ACCENT = "#4f46e5";
const HIT_WIDTH = 12;
const TERMINAL_RADIUS = 4;
const TERMINAL_COLOR = "#dc2626"; // the places a wire can end, with the wire tool

const setCursor = (value: string) => (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => {
  const box = e.target.getStage()?.container();
  if (box) box.style.cursor = value;
};

// One shape of a symbol (a polyline, a closed outline, a filled polygon or a circle) as a Konva node.
function Shapes({ shapes, color = INK, opacity = 1 }: { shapes: SymbolShape[]; color?: string; opacity?: number }) {
  return (
    <>
      {shapes.map((s, i) =>
        s.kind === "circle" ? (
          <Circle key={i} x={s.cx} y={s.cy} radius={s.r} stroke={color} strokeWidth={SYMBOL_STROKE} fill={s.fill ? color : undefined} opacity={opacity} listening={false} />
        ) : (
          <Line key={i} points={s.points} stroke={color} strokeWidth={SYMBOL_STROKE} fill={s.kind === "poly" ? color : undefined} closed={s.kind !== "line"} lineCap="round" lineJoin="round" opacity={opacity} listening={false} />
        ),
      )}
    </>
  );
}

// The dot grid of the drawing area, in one path.
function DotGrid({ width, height }: { width: number; height: number }) {
  return (
    <Shape
      listening={false}
      fill="#c7ced9"
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        for (let x = GRID; x < width; x += GRID) for (let y = GRID; y < height; y += GRID) ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
        ctx.fillShape(shape);
      }}
    />
  );
}

// The circuit on a Konva stage: a white sheet with a faint dot grid, the wires, the components and the dots where wires meet, all
// from the scene of _lib/circuit/scene.ts (the same one the picture for the page is made from). The drawing is shown smaller
// when it does not fit the window. A click goes to what is under it: with the Select tool it selects (and a drag moves a
// component, or a wire); with a component tool it puts one there (a ghost shows where, on the grid); with the Wire tool it draws,
// from terminal to terminal, along horizontal and vertical lines only.
export default function CircuitCanvas({ studio }: { studio: CircuitStudioState }) {
  const t = useT();
  const { config, tool, selectedComponent, selectedWire, draft, pendingRotation } = studio;
  const box = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [pointer, setPointer] = useState<P | null>(null); // where the mouse is on the drawing, when a tool needs to know
  const [shift, setShift] = useState(false);
  const [dragVersion, setDragVersion] = useState(0); // (a dragged node is put back where the state says it is, by making a new one)
  const scene = useMemo(() => buildCircuitScene(config), [config]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = area.w > 0 && area.h > 0 ? Math.min(1, (area.w - 2 * AREA_PADDING) / config.width, (area.h - 2 * AREA_PADDING) / config.height) : 1;
  const scale = Math.max(MIN_SCALE, fit);
  const percent = Math.round(scale * 100);

  const paperPoint = (stage: Konva.Stage | null): P | null => {
    const p = stage?.getPointerPosition();
    return p ? { x: p.x / scale, y: p.y / scale } : null;
  };

  const placing = tool !== "select" && tool !== "wire" && tool !== "shape" ? (tool as ComponentType) : null;
  const target = pointer && tool === "wire" ? snapTarget(config, pointer) : null;
  const ghost = pointer && placing ? drawComponent(newComponent(config, placing, pointer.x, pointer.y, pendingRotation, "ghost")) : null;
  const preview = draft && target ? routeNext(draft.points, draft.startDir, target.point, shift) : null;

  const onBackgroundClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const p = paperPoint(e.target.getStage());
    if (!p) return;
    if (placing) studio.placeComponent(placing, p.x, p.y);
    else if (tool === "wire") studio.wireClick(snapTarget(config, p), e.evt.shiftKey);
    else studio.clearSelection();
  };

  const selecting = tool === "select";

  return (
    <div ref={box} dir="ltr" data-testid="circuit-canvas" className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-subtle/60 p-4">
      <div className="shadow-sm" style={{ width: config.width * scale, height: config.height * scale, cursor: tool === "select" ? undefined : "crosshair" }} aria-label={t("Circuit drawing area")} role="img">
        <Stage
          width={config.width * scale}
          height={config.height * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseMove={(e) => {
            if (tool === "select") return;
            setShift(e.evt.shiftKey);
            const p = paperPoint(e.target.getStage());
            if (p) setPointer(p);
          }}
          onMouseLeave={() => setPointer(null)}
          onDblClick={() => {
            if (tool === "wire") studio.finishWire(); // (the click before it has already put the last corner)
          }}
        >
          <Layer>
            <Rect width={config.width} height={config.height} fill="#ffffff" onClick={onBackgroundClick} />
            <DotGrid width={config.width} height={config.height} />

            {/* the wires */}
            {scene.wires.map((w) => {
              const isSelected = w.id === selectedWire?.id;
              return (
                <Group key={`${w.id}-${dragVersion}`}>
                  {isSelected && <Line points={w.points} stroke={ACCENT} strokeWidth={WIRE_STROKE + 6} opacity={0.3} lineCap="round" lineJoin="round" listening={false} />}
                  <Line
                    points={w.points}
                    stroke={INK}
                    strokeWidth={WIRE_STROKE}
                    lineCap="round"
                    lineJoin="round"
                    hitStrokeWidth={HIT_WIDTH}
                    listening={selecting}
                    draggable={selecting && isSelected}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      studio.selectWire(w.id);
                    }}
                    onDragStart={() => studio.selectWire(w.id)}
                    onDragEnd={(e) => {
                      studio.moveWireBy(w.id, e.target.x(), e.target.y());
                      setDragVersion((v) => v + 1);
                    }}
                    onMouseEnter={(e) => setCursor(isSelected ? "move" : "pointer")(e)}
                    onMouseLeave={(e) => setCursor("")(e)}
                  />
                </Group>
              );
            })}

            {/* the components: the symbol, its texts, and a box to click and drag */}
            {scene.components.map((c) => {
              const isSelected = c.id === selectedComponent?.id;
              return (
                <Group key={c.id}>
                  {isSelected && <Rect x={c.bounds.x} y={c.bounds.y} width={c.bounds.width} height={c.bounds.height} stroke={ACCENT} strokeWidth={1.5} dash={[5, 4]} cornerRadius={4} listening={false} />}
                  <Shapes shapes={c.shapes} />
                  {c.texts.map((text, i) => (
                    <Text
                      key={i}
                      text={text.text}
                      x={text.x - (text.align === "start" ? 0 : text.align === "middle" ? TEXT_BOX / 2 : TEXT_BOX)}
                      y={text.y - text.size}
                      width={TEXT_BOX}
                      height={2 * text.size}
                      align={text.align === "start" ? "left" : text.align === "middle" ? "center" : "right"}
                      verticalAlign="middle"
                      wrap="none"
                      fontFamily={FONT}
                      fontSize={text.size}
                      fontStyle={text.bold ? "bold" : "normal"}
                      fill={INK}
                      listening={false}
                    />
                  ))}
                  <Rect
                    key={`${c.id}-${dragVersion}`}
                    x={c.bounds.x}
                    y={c.bounds.y}
                    width={c.bounds.width}
                    height={c.bounds.height}
                    fill="transparent"
                    listening={selecting}
                    draggable={selecting}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      studio.selectComponent(c.id);
                    }}
                    onDragStart={() => studio.selectComponent(c.id)}
                    onDragMove={(e) => studio.moveComponentTo(c.id, e.target.x() + c.bounds.width / 2, e.target.y() + c.bounds.height / 2)}
                    onDragEnd={() => setDragVersion((v) => v + 1)}
                    onMouseEnter={(e) => setCursor("move")(e)}
                    onMouseLeave={(e) => setCursor("")(e)}
                  />
                </Group>
              );
            })}

            {/* where wires are connected */}
            {scene.junctions.map((j, i) => (
              <Circle key={i} x={j.x} y={j.y} radius={JUNCTION_RADIUS} fill={INK} listening={false} />
            ))}

            {/* the shapes drawn over the circuit */}
            <StudioShapes shapes={config.shapes ?? []} selectedId={studio.selectedShape?.id ?? null} interactive={selecting} scale={scale} onSelect={studio.selectShape} onChange={studio.changeShape} />

            {/* with the wire tool the places a wire can end are shown, and the one it would go to is filled */}
            {tool === "wire" &&
              scene.components.flatMap((c) =>
                c.terminals.map((p, i) => {
                  const on = !!target?.connects && Math.abs(target.point.x - p.x) < 0.5 && Math.abs(target.point.y - p.y) < 0.5;
                  return <Circle key={`${c.id}-${i}`} x={p.x} y={p.y} radius={on ? TERMINAL_RADIUS + 1.5 : TERMINAL_RADIUS} stroke={TERMINAL_COLOR} strokeWidth={1.5} fill={on ? TERMINAL_COLOR : "#ffffff"} listening={false} />;
                }),
              )}

            {/* the wire being drawn: what is put, and what a click would add */}
            {draft && <Line points={draft.points} stroke={ACCENT} strokeWidth={WIRE_STROKE} lineCap="round" lineJoin="round" listening={false} />}
            {preview && <Line points={preview} stroke={ACCENT} strokeWidth={WIRE_STROKE} dash={[6, 4]} lineCap="round" lineJoin="round" listening={false} />}
            {target && <Circle x={target.point.x} y={target.point.y} radius={target.connects ? 6 : 3.5} stroke={ACCENT} strokeWidth={1.5} fill={target.connects ? "transparent" : ACCENT} listening={false} />}

            {/* the component about to be put, where it would go */}
            {ghost && <Shapes shapes={ghost.shapes} color={ACCENT} opacity={0.6} />}

            {/* with the Shapes tool: drag to draw the shape chosen in the gallery */}
            {tool === "shape" && <ShapeDrawSurface width={config.width} height={config.height} shape={studio.shapeKind} snap={GRID / 2} onDraw={studio.drawShape} />}
          </Layer>
        </Stage>
      </div>
      {percent < 100 && (
        <p data-testid="circuit-scale-note" className="absolute bottom-2 start-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-muted shadow-sm">
          {t("The drawing is shown at {percent}% to fit the window.", { percent })}
        </p>
      )}
    </div>
  );
}

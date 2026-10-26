"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import { ANNOTATION_HINTS, ANNOTATION_SPECS, POINTS_HINT } from "@/app/_lib/graph/annotations";
import { PAPER_MARGIN, buildScene, pxToGraphX, pxToGraphY, type Segment } from "@/app/_lib/graph/grid";
import { AXIS_WIDTH, INK, MAJOR_WIDTH, MINOR_OPACITY, MINOR_WIDTH, TICK_WIDTH } from "@/app/_lib/graph/svg";
import { useT } from "@/app/_lib/uiLang";
import type { GraphStudioState } from "./useGraphStudio";

const FONT = "Arial, Helvetica, sans-serif";
const TEXT_BOX = 120; // a text of the axes is laid out in a box this wide, aligned inside it
const AREA_PADDING = 32;
const MIN_SCALE = 0.1;
const ACCENT = "#4f46e5"; // the selected curve or annotation
const HANDLE_RADIUS = 6;
const HIT_WIDTH = 12;
const DOT_RADIUS = 4; // a measured point
const MASKED_OPACITY = 0.4; // masked, in the teacher's view
const MASKED_DASH = [6, 4];
const round3 = (v: number) => Math.round(v * 1000) / 1000; // (a dragged text is not at 6.99166666 in its field)

const setCursor = (value: string) => (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => {
  const box = e.target.getStage()?.container();
  if (box) box.style.cursor = value;
};

// All the segments of a kind in one path: a fine grid is hundreds of lines, and one Konva shape each would be slow.
function Segments({ segments, color, width, opacity = 1 }: { segments: Segment[]; color: string; width: number; opacity?: number }) {
  if (!segments.length) return null;
  return (
    <Shape
      listening={false}
      stroke={color}
      strokeWidth={width}
      opacity={opacity}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        for (const s of segments) {
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
        }
        ctx.strokeShape(shape);
      }}
    />
  );
}

// The graph paper on a Konva stage: a white sheet with its fine and main grid, the two axes with their arrows, the ticks, the
// numbers and the labels, the curves and the annotations, all from the scene of grid.ts (the same one the picture for the page
// is made from). The paper is shown smaller when it does not fit the window; its size on the page does not change.
// A click goes to what is under it: with an annotation tool in hand it places one (on a curve or on the paper); otherwise it
// selects the curve or annotation, or lets go of the selection. The selected annotation shows its handles to drag.
export default function GraphCanvas({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, tool, selected, selectedAnnotation, handles, snap, view } = studio;
  const student = view === "student"; // the student's version is only looked at: nothing here answers a click
  const box = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [dragVersion, setDragVersion] = useState(0); // (a dragged node is put back where the state says it is, by making a new one)
  const [notice, setNotice] = useState<string | null>(null);
  const scene = useMemo(() => buildScene(config, { student }), [config, student]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = { w: config.width + 2 * PAPER_MARGIN, h: config.height + 2 * PAPER_MARGIN };
  const fit = area.w > 0 && area.h > 0 ? Math.min(1, (area.w - 2 * AREA_PADDING) / total.w, (area.h - 2 * AREA_PADDING) / total.h) : 1;
  const scale = Math.max(MIN_SCALE, fit);
  const percent = Math.round(scale * 100);

  // Where the mouse is, in pixels of the paper (null outside the stage).
  const paperPoint = (stage: Konva.Stage | null) => {
    const p = stage?.getPointerPosition();
    return p ? { x: p.x / scale - PAPER_MARGIN, y: p.y / scale - PAPER_MARGIN } : null;
  };
  const snapTo = (v: number) => (snap && config.minorGridStep > 0 ? Math.round(v / config.minorGridStep) * config.minorGridStep : v);

  // A click with a tool in hand (`curveId`: it was on that curve).
  const place = (e: Konva.KonvaEventObject<MouseEvent>, curveId: string | null) => {
    if (!tool) return;
    const p = paperPoint(e.target.getStage());
    if (!p || p.x < 0 || p.y < 0 || p.x > config.width || p.y > config.height) return;
    const gx = pxToGraphX(p.x, config);
    const gy = pxToGraphY(p.y, config);
    if (tool === "points") return studio.addDataPoint(snapTo(gx), snapTo(gy)); // (the tool stays in hand: there are many points to put)
    const free = tool === "text"; // (a text goes exactly where it is clicked)
    const ok = studio.placeAnnotation(tool, { x: free ? gx : snapTo(gx), y: free ? gy : snapTo(gy), curveId });
    if (!ok) {
      setNotice(t("A tangent needs a curve: draw one first."));
      window.setTimeout(() => setNotice(null), 3000);
    }
  };

  const onBackgroundClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool) place(e, null);
    else studio.selectFunction(null);
  };

  return (
    <div ref={box} dir="ltr" data-testid="graph-canvas" className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-subtle/60 p-4">
      <div className="shadow-sm" style={{ width: total.w * scale, height: total.h * scale, cursor: tool ? "crosshair" : undefined }} aria-label={t("Graph paper preview")} role="img">
        <Stage width={total.w * scale} height={total.h * scale} scaleX={scale} scaleY={scale}>
          <Layer listening={!student}>
            {/* the margin is the same white as the paper: the arrows and the labels may go past its edge */}
            <Rect width={total.w} height={total.h} fill="#ffffff" onClick={onBackgroundClick} onTap={() => studio.selectFunction(null)} />
            {/* everything below is in pixels of the paper, whose corner is at the margin */}
            <Group x={PAPER_MARGIN} y={PAPER_MARGIN}>
              <Segments segments={scene.minor} color={config.gridColor} width={MINOR_WIDTH} opacity={MINOR_OPACITY} />
              <Segments segments={scene.major} color={config.gridColor} width={MAJOR_WIDTH} />
              {/* the curves go over the grid and under the axes; a click on one selects it (its line is clicked within 6 px) */}
              {scene.curves.map((curve) => {
                const isSelected = curve.id === selected?.id;
                return curve.segments.map((points, i) => (
                  <Group key={curve.id + i}>
                    {isSelected && <Line points={points} stroke={ACCENT} strokeWidth={curve.width + 6} opacity={0.3} lineCap="round" lineJoin="round" listening={false} />}
                    <Line
                      points={points}
                      stroke={curve.color}
                      strokeWidth={curve.width}
                      opacity={curve.hidden ? MASKED_OPACITY : 1}
                      dash={curve.hidden ? MASKED_DASH : undefined}
                      lineCap="round"
                      lineJoin="round"
                      hitStrokeWidth={Math.max(HIT_WIDTH, curve.width + 8)}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (tool) place(e, curve.id);
                        else studio.selectFunction(curve.id);
                      }}
                      onTap={() => studio.selectFunction(curve.id)}
                      onMouseEnter={(e) => setCursor(tool ? "crosshair" : "pointer")(e)}
                      onMouseLeave={(e) => setCursor("")(e)}
                    />
                  </Group>
                ));
              })}
              {/* the measured points: small circles, white inside; with their series selected they can be dragged, and Shift+click with the points tool takes one away */}
              {scene.curves.flatMap((curve) =>
                curve.dots.map((d) => (
                  <Circle
                    key={`${curve.id}-${d.id}-${dragVersion}`}
                    x={d.x}
                    y={d.y}
                    radius={curve.id === selected?.id ? DOT_RADIUS + 1 : DOT_RADIUS}
                    fill="#ffffff"
                    stroke={curve.color}
                    strokeWidth={2}
                    opacity={curve.hidden ? MASKED_OPACITY : 1}
                    hitStrokeWidth={8}
                    draggable={curve.id === selected?.id && !tool}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (tool === "points" && e.evt.shiftKey) studio.removeDataPoint(curve.id, d.id);
                      else if (tool) place(e, null);
                      else studio.selectFunction(curve.id);
                    }}
                    onTap={() => studio.selectFunction(curve.id)}
                    onDragMove={(e) => {
                      const p = paperPoint(e.target.getStage());
                      if (p) studio.updateDataPoint(curve.id, d.id, { x: round3(snapTo(pxToGraphX(p.x, config))), y: round3(snapTo(pxToGraphY(p.y, config))) });
                    }}
                    onDragEnd={() => setDragVersion((v) => v + 1)}
                    onMouseEnter={(e) => setCursor(tool ? "crosshair" : curve.id === selected?.id ? "grab" : "pointer")(e)}
                    onMouseLeave={(e) => setCursor("")(e)}
                  />
                )),
              )}
              <Segments segments={scene.axes} color={INK} width={AXIS_WIDTH} />
              <Segments segments={scene.ticks} color={INK} width={TICK_WIDTH} />
              {scene.arrows.map((points, i) => (
                <Line key={i} points={points} closed fill={INK} listening={false} />
              ))}

              {/* the annotations (with a tool in hand they let the click through to place the next one) */}
              {scene.annotations.map((a) => {
                const isSelected = a.id === selectedAnnotation?.id;
                const pick = (e: Konva.KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true;
                  studio.selectAnnotation(a.id);
                };
                return (
                  <Group key={a.id} listening={!tool} opacity={a.hidden ? MASKED_OPACITY : 1}>
                    {a.lines.map((l, i) => (
                      <Group key={i}>
                        {isSelected && <Line points={l.points} stroke={ACCENT} strokeWidth={l.width + 6} opacity={0.3} lineCap="round" listening={false} />}
                        <Line points={l.points} stroke={a.color} strokeWidth={l.width} dash={a.hidden ? MASKED_DASH : l.dash} lineCap="round" lineJoin="round" hitStrokeWidth={HIT_WIDTH} onClick={pick} onTap={() => studio.selectAnnotation(a.id)} onMouseEnter={(e) => setCursor("pointer")(e)} onMouseLeave={(e) => setCursor("")(e)} />
                      </Group>
                    ))}
                    {a.dots.map((d, i) => (
                      <Circle key={i} x={d.x} y={d.y} radius={d.r} fill={a.color} stroke={isSelected ? ACCENT : undefined} strokeWidth={isSelected ? 2 : 0} onClick={pick} onTap={() => studio.selectAnnotation(a.id)} />
                    ))}
                    {a.texts.map((text, i) => {
                      const movable = a.type === "text";
                      return (
                        <Text
                          key={`${i}-${movable ? dragVersion : 0}`}
                          text={text.text}
                          x={text.x}
                          y={text.y}
                          offsetY={text.size / 2}
                          // (a text is as wide as it is: where it sits against its anchor is set through its offset, below)
                          fontFamily={FONT}
                          fontSize={text.size}
                          fontStyle={text.bold ? "bold" : "normal"}
                          fill={a.color}
                          stroke={isSelected ? "#c7d2fe" : "#ffffff"}
                          strokeWidth={isSelected ? 5 : 3}
                          fillAfterStrokeEnabled
                          lineJoin="round"
                          draggable={movable}
                          onClick={pick}
                          onTap={() => studio.selectAnnotation(a.id)}
                          onDragStart={() => studio.selectAnnotation(a.id)}
                          onDragMove={(e) => studio.updateAnnotation(a.id, { x: round3(pxToGraphX(e.target.x(), config)), y: round3(pxToGraphY(e.target.y(), config)) })}
                          onDragEnd={() => setDragVersion((v) => v + 1)}
                          onMouseEnter={(e) => setCursor(movable ? "move" : "pointer")(e)}
                          onMouseLeave={(e) => setCursor("")(e)}
                          ref={(node) => {
                            // end/middle aligned texts are shifted by their own width, known only once drawn
                            if (node && text.align !== "start") node.offsetX(text.align === "end" ? node.width() : node.width() / 2);
                          }}
                        />
                      );
                    })}
                  </Group>
                );
              })}

              {/* the handles of the selected annotation */}
              {!tool &&
                !student &&
                selectedAnnotation &&
                handles.map((h) => (
                  <Circle
                    key={`${selectedAnnotation.id}-${h.role}-${dragVersion}`}
                    x={h.x}
                    y={h.y}
                    radius={HANDLE_RADIUS}
                    fill="#ffffff"
                    stroke={ACCENT}
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => {
                      const p = paperPoint(e.target.getStage());
                      if (p) studio.dragHandle(selectedAnnotation.id, h.role, pxToGraphX(p.x, config), pxToGraphY(p.y, config));
                    }}
                    onDragEnd={() => setDragVersion((v) => v + 1)}
                    onMouseEnter={(e) => setCursor("grab")(e)}
                    onMouseLeave={(e) => setCursor("")(e)}
                  />
                ))}

              {scene.texts.map((text, i) => (
                // (a white halo keeps a text readable over the grid)
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
                  fill={INK}
                  stroke="#ffffff"
                  strokeWidth={3}
                  fillAfterStrokeEnabled
                  lineJoin="round"
                  listening={false}
                />
              ))}
            </Group>
          </Layer>
        </Stage>
      </div>
      {tool && (
        <p data-testid="graph-tool-hint" className="absolute start-3 top-3 max-w-sm rounded-lg border border-accent bg-white/95 px-2.5 py-1.5 text-xs text-accent-strong shadow-sm">
          {t(tool === "points" ? POINTS_HINT : ANNOTATION_HINTS[tool])} · {t(tool === "points" ? "Measurements" : ANNOTATION_SPECS[tool].name)} · Esc
        </p>
      )}
      {notice && (
        <p role="status" data-testid="graph-notice" className="absolute start-3 top-14 flex max-w-sm items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 shadow-sm">
          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
          {notice}
        </p>
      )}
      {percent < 100 && (
        <p data-testid="graph-scale-note" className="absolute bottom-2 start-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-muted shadow-sm">
          {t("The graph paper is shown at {percent}% to fit the window.", { percent })}
        </p>
      )}
    </div>
  );
}

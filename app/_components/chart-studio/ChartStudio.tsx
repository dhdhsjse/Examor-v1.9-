"use client";

import { ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, Plus, Redo2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import type { ShapePatch } from "@/app/_components/shapes/StudioShapes";
import TableDrawingLayer, { type TableTool } from "@/app/_components/table-studio/TableDrawingLayer";
import TableToolDock from "@/app/_components/table-studio/TableToolDock";
import { renderChartSvg } from "@/app/_lib/chart/render";
import { CHART_COLORS, MAX_CHART_SIZE, MIN_CHART_SIZE, isRoundChart, newChart, type ChartConfig, type ChartKind } from "@/app/_lib/chart/types";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";
import { eraseStrokes } from "@/app/_lib/ink/eraser";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import { svgUrl } from "@/app/_lib/library";
import { addShape, newShapeId, removeShape, updateShape, type ShapeItem, type ShapeStyle } from "@/app/_lib/shapes";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";
import { useUi } from "@/app/_lib/uiLang";

interface Props {
  /** The chart of the block being edited; null = a new chart */
  editing: ChartConfig | null;
  onInsert: (config: ChartConfig) => void;
  onUpdate: (config: ChartConfig) => void;
  onClose: () => void;
}

// (small drawings for the kinds lucide has no icon for: sticks, a histogram, a half disc)
const icon = (children: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const STICKS = icon(
  <>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M8 17v-6M13 17V7M18 17v-4" />
  </>,
);
const HISTOGRAM = icon(
  <>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 17v-6h4v6M11 17V7h4v10M15 17v-4h4v4" />
  </>,
);
const HALF_PIE = icon(
  <>
    <path d="M3 17a9 9 0 0 1 18 0Z" />
    <path d="M12 17 7 9.5M12 17l6-6" />
  </>,
);

// The kinds, in two rows of four (the names are translated)
const KINDS: { kind: ChartKind; label: string; icon: ReactNode }[] = [
  { kind: "bar", label: "Bar chart", icon: <ChartColumn size={16} /> },
  { kind: "hbar", label: "Horizontal bars", icon: <ChartBar size={16} /> },
  { kind: "stick", label: "Sticks", icon: STICKS },
  { kind: "histogram", label: "Histogram", icon: HISTOGRAM },
  { kind: "line", label: "Line chart", icon: <ChartLine size={16} /> },
  { kind: "area", label: "Area chart", icon: <ChartArea size={16} /> },
  { kind: "pie", label: "Pie", icon: <ChartPie size={16} /> },
  { kind: "halfpie", label: "Half pie", icon: HALF_PIE },
];

const inputCls = "h-7 w-full min-w-0 rounded-[5px] border border-transparent bg-subtle px-2 text-xs text-ink outline-none hover:border-line focus:border-accent focus:bg-white";
const PADDING = 24; // (room round the chart in the middle)
const DOCK_ROOM = 56; // (and under it, for the floating tool bar)
const MIN_SCALE = 0.25;
// A text box drawn over the chart that was left empty goes away (it would be an invisible box)
const emptyTextBox = (s: ShapeItem | undefined) => !!s && !s.text?.trim() && s.fill === null && s.stroke === null;

// The Chart Studio: a chart made from a short list of names and values, as bars, sticks, a histogram, a line, an area or a (half) pie. The
// settings on the left, the chart in the middle as it will be printed, with the floating tool bar of the page under it (select, draw, text
// box, eraser, math keyboard): what it draws goes on the chart's picture. It goes on the page as a picture that keeps its settings:
// double-click it to come back here. The chart has its own undo and redo; the exam's history gets one step on Insert or Update.
export default function ChartStudio({ editing, onInsert, onUpdate, onClose }: Props) {
  const { t } = useUi();
  const [history, setHistory] = useState<StudioHistory<ChartConfig>>(() => startStudioHistory(editing ?? newChart()));
  const chart = history.present;
  const dirty = isStudioDirty(history);
  const [confirmClose, setConfirmClose] = useState(false);
  // `key` names what changed, so that typing in a field or dragging a drawing is one step of the undo
  const edit = useCallback((fn: (c: ChartConfig) => ChartConfig, key: string) => setHistory((h) => editStudioHistory(h, fn(h.present), key, Date.now())), []);
  const change = (patch: Partial<ChartConfig>, key = Object.keys(patch).join(",")) => edit((c) => ({ ...c, ...patch }), key);
  const setRow = (i: number, patch: Partial<ChartConfig["rows"][number]>) =>
    edit((c) => ({ ...c, rows: c.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) }), `row:${i}:${Object.keys(patch).join(",")}`);
  const undo = () => setHistory(undoStudioHistory);
  const redo = () => setHistory(redoStudioHistory);

  // ---- the floating tool bar and what it draws over the chart ----
  const ink = useInkTools(); // (the page's Draw tool: the same brush, pencil and highlighter, kept between sessions)
  const eraser = useEraserTool(); // (the page's Eraser)
  const [tool, setToolState] = useState<TableTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textId, setTextId] = useState<string | null>(null); // the drawing whose text is being typed
  const shapes = chart.shapes ?? [];
  const selectedShape = shapes.find((s) => s.id === selectedId) ?? null; // (what undo took away is no longer selected)
  const setTool = (next: TableTool) => {
    setToolState(next);
    if (next !== "select") setSelectedId(null);
  };
  const setShapes = (fn: (list: ShapeItem[]) => ShapeItem[], key: string) =>
    edit((c) => {
      const left = fn(c.shapes ?? []);
      return { ...c, shapes: left.length ? left : undefined };
    }, key);
  const addDrawing = (item: ShapeItem) => {
    setShapes((list) => addShape(list, item), `add:${item.id}`);
    if (tool === "draw") return; // (the brush stays in hand: a drawing is many strokes)
    setSelectedId(item.id);
    setToolState("select"); // (one shape, then the Select tool is back)
    if (tool === "textbox") setTextId(item.id); // (a text box: type in it at once)
  };
  const deleteShape = (id: string, key = `remove:${id}`) => {
    setShapes((list) => removeShape(list, id), key);
    setSelectedId(null);
  };
  const editText = (id: string | null) => {
    const typed = shapes.find((s) => s.id === textId);
    setTextId(id);
    if (!id && typed && emptyTextBox(typed)) deleteShape(typed.id, `add:${typed.id}`); // (the same step of the undo as drawing it)
  };
  const textStyle = useMemo<Partial<ShapeStyle>>(() => ({ fontSize: 14, textAlign: "left", textVAlign: "top" }), []);

  // The chart is shown whole: at its size, or smaller when the window is too small for it.
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRoom({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = room.w > 0 && room.h > 0 ? Math.min(1, (room.w - 2 * PADDING) / chart.width, (room.h - 2 * PADDING - DOCK_ROOM) / chart.height) : 1;
  const scale = Math.max(MIN_SCALE, fit);

  // (the drawings are on the layer over it, not in the picture shown here)
  const src = useMemo(() => svgUrl(renderChartSvg({ ...chart, shapes: undefined })), [chart]);
  const empty = !chart.rows.some((r) => r.value !== null);
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // Esc puts the tool down, then lets go of the drawing selected, then closes (asking first when something changed); a field being typed in
  // only loses the focus. Delete removes the drawing selected. Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return el.blur();
        if (tool !== "select") setTool("select");
        else if (selectedShape) setSelectedId(null);
        else requestClose();
      } else if (typing) {
        return;
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedShape) {
        e.preventDefault();
        deleteShape(selectedShape.id);
      } else if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = studioHeaderProps();
  const axes = !isRoundChart(chart.kind);
  const iconButton = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";

  return (
    <div data-testid="chart-studio" className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...header} className={`${header.className} gap-2! py-1.5!`}>
        <h2 className="shrink-0 text-sm font-semibold text-ink">{t("Chart Studio")}</h2>
        <div className="mx-1 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndoStudio(history)} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedoStudio(history)} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={15} />
        </button>
        <button
          onClick={() => (editing ? onUpdate(chart) : onInsert(chart))}
          disabled={empty}
          title={empty ? t("Type at least one value first.") : undefined}
          data-testid="insert"
          className="ms-auto h-7 shrink-0 rounded bg-accent px-3 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-7 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col divide-y divide-line overflow-y-auto border-line bg-white ltr:border-r rtl:border-l" data-testid="chart-panel">
          <Section title={t("Kind")}>
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={t("Kind")}>
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  role="radio"
                  aria-checked={chart.kind === k.kind}
                  title={t(k.label)}
                  data-testid={`kind-${k.kind}`}
                  onClick={() => change({ kind: k.kind })}
                  className={`flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[5px] border px-0.5 py-1.5 text-center text-[11px] leading-tight transition-colors ${chart.kind === k.kind ? "border-accent font-semibold text-accent" : "border-line text-ink hover:border-faint"}`}
                >
                  {k.icon}
                  <span className="w-full break-words">{t(k.label)}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t("Title")}>
            <input value={chart.title} onChange={(e) => change({ title: e.target.value })} placeholder={t("No title")} className={inputCls} data-testid="chart-title" />
          </Section>

          <Section title={t("Values")}>
            <div className="grid grid-cols-[1fr_5rem_1.5rem] items-center gap-1 text-xs text-muted">
              <span>{t("Name")}</span>
              <span>{t("Value")}</span>
              <span />
              {chart.rows.map((r, i) => (
                <Row
                  key={i}
                  i={i}
                  label={r.label}
                  value={r.value}
                  onLabel={(label) => setRow(i, { label })}
                  onValue={(value) => setRow(i, { value })}
                  onRemove={chart.rows.length > 1 ? () => change({ rows: chart.rows.filter((_, k) => k !== i) }, `remove-row:${Date.now()}`) : undefined}
                  t={t}
                />
              ))}
            </div>
            <button
              type="button"
              data-testid="add-row"
              onClick={() => change({ rows: [...chart.rows, { label: String.fromCharCode(65 + (chart.rows.length % 26)), value: null }] }, `add-row:${Date.now()}`)}
              className="flex h-7 w-full items-center gap-1.5 rounded-[5px] px-2 text-xs text-muted hover:bg-hover hover:text-ink"
            >
              <Plus size={12} strokeWidth={2} aria-hidden /> {t("Add a value")}
            </button>
          </Section>

          {axes && (
            <Section title={t("Axes")}>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t("Horizontal axis")}
                <input value={chart.xTitle} onChange={(e) => change({ xTitle: e.target.value })} placeholder={t("No title")} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t("Vertical axis")}
                <input value={chart.yTitle} onChange={(e) => change({ yTitle: e.target.value })} placeholder={t("No title")} className={inputCls} />
              </label>
            </Section>
          )}

          <Section title={t("Look")}>
            {axes && (
              <div className="flex flex-wrap gap-1" role="group" aria-label={t("Color")}>
                {CHART_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => change({ color: c })}
                    aria-label={`${t("Color")} ${c}`}
                    aria-pressed={chart.color === c}
                    style={{ background: c }}
                    className={`size-5 rounded-full ${chart.color === c ? "ring-2 ring-accent ring-offset-1" : ""}`}
                  />
                ))}
              </div>
            )}
            <Check checked={chart.showValues} onChange={(showValues) => change({ showValues })} label={axes ? t("Show the values") : t("Show the percentages")} />
            {axes && <Check checked={chart.grid} onChange={(grid) => change({ grid })} label={t("Show grid")} />}
          </Section>

          <Section title={t("Size on the page")}>
            <div className="grid grid-cols-2 gap-2">
              <Size label={t("Width (px)")} value={chart.width} onChange={(width) => change({ width })} />
              <Size label={t("Height (px)")} value={chart.height} onChange={(height) => change({ height })} />
            </div>
          </Section>
        </aside>

        <main className="studio-desk relative flex min-w-0 flex-1 flex-col bg-subtle">
          <div ref={area} className="grid min-h-0 flex-1 place-items-center overflow-auto p-6 pb-20">
            <div dir="ltr" data-paper="" className="relative bg-white shadow-sm" style={{ width: chart.width * scale, height: chart.height * scale }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the chart's own SVG, as the page will show it */}
              <img src={src} alt={t("Chart")} data-testid="chart-preview" draggable={false} className="block size-full select-none" />
              {/* the drawings, shapes and text boxes of the floating bar, over the chart */}
              {/* (the wrapper lets the mouse through: the layer itself takes it only with a drawing tool or over a drawing) */}
              <div className="pointer-events-none absolute left-0 top-0">
                <TableDrawingLayer
                  width={chart.width}
                  rowsHeight={chart.height}
                  roomBelow={0}
                  clip
                  scale={scale}
                  shapes={shapes}
                  tool={tool}
                  shapeKind="rect"
                  ink={ink}
                  textStyle={textStyle}
                  selectedId={selectedShape?.id ?? null}
                  editingId={textId}
                  onSelect={setSelectedId}
                  onChange={(id: string, patch: ShapePatch, key: string) => setShapes((list) => updateShape(list, id, patch), key)}
                  onAdd={addDrawing}
                  eraser={eraser}
                  onErase={(ids, gesture) => setShapes((list) => list.filter((s) => !ids.has(s.id)), gesture)}
                  onEraseInk={(path, radius, gesture) => setShapes((list) => eraseStrokes(list, path, radius, newShapeId) ?? list, gesture)}
                  onEdit={editText}
                />
              </div>
            </div>
          </div>
          {/* the floating tool bar of the page: select, draw (brush, pencil, highlighter), text box, eraser, math keyboard */}
          <TableToolDock tool={tool} onTool={setTool} ink={ink} eraser={eraser} textboxHint={t("Text box: drag on the chart to draw one, then type")} />
        </main>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 px-3 py-2.5">
      <h3 className="text-xs font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}

// One value of the list: its name, its number (empty = not filled in), and a button to remove it
function Row({
  i,
  label,
  value,
  onLabel,
  onValue,
  onRemove,
  t,
}: {
  i: number;
  label: string;
  value: number | null;
  onLabel: (v: string) => void;
  onValue: (v: number | null) => void;
  onRemove?: () => void;
  t: (s: string) => string;
}) {
  // the text typed is kept as it is ("2," on its way to "2,5"); the number is read from it
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    if (Number(draft.replace(",", ".")) !== value) setDraft(value === null ? "" : String(value));
  }
  return (
    <>
      <input value={label} onChange={(e) => onLabel(e.target.value)} aria-label={`${t("Name")} ${i + 1}`} className={inputCls} data-testid={`row-label-${i}`} />
      <input
        value={draft}
        inputMode="decimal"
        dir="ltr"
        aria-label={`${t("Value")} ${i + 1}`}
        data-testid={`row-value-${i}`}
        onChange={(e) => {
          const s = e.target.value;
          setDraft(s);
          const v = Number(s.replace(",", "."));
          onValue(s.trim() === "" || !Number.isFinite(v) ? null : v);
        }}
        className={`${inputCls} text-end tabular-nums`}
      />
      {onRemove ? (
        <button type="button" onClick={onRemove} title={t("Remove")} aria-label={t("Remove")} className="grid size-6 place-items-center rounded-[5px] text-faint hover:bg-red-50 hover:text-red-700">
          <X size={12} aria-hidden />
        </button>
      ) : (
        <span />
      )}
    </>
  );
}

function Size({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  // (an undo puts the field back too)
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setDraft(String(value));
  }
  const commit = () => {
    const v = Math.round(Number(draft));
    const ok = Number.isFinite(v) ? Math.max(MIN_CHART_SIZE, Math.min(MAX_CHART_SIZE, v)) : value;
    setDraft(String(ok));
    if (ok !== value) onChange(ok);
  };
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        value={draft}
        inputMode="numeric"
        dir="ltr"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={`${inputCls} tabular-nums`}
      />
    </label>
  );
}

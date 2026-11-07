"use client";

import { Crop, Redo2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import type { ShapePatch } from "@/app/_components/shapes/StudioShapes";
import TableDrawingLayer, { type TableTool } from "@/app/_components/table-studio/TableDrawingLayer";
import TableToolDock from "@/app/_components/table-studio/TableToolDock";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";
import { fitRatio, fullCrop, isFullCrop, roundCrop } from "@/app/_lib/imageStudio/crop";
import { drawingsSvg, renderEditedImage } from "@/app/_lib/imageStudio/render";
import type { CropRect, ImageEdit, ImageEditDoc } from "@/app/_lib/imageStudio/types";
import { eraseStrokes } from "@/app/_lib/ink/eraser";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import { svgUrl } from "@/app/_lib/library";
import { addShape, duplicateShape, newShapeId, removeShape, reorderShape, updateShape, type ShapeItem, type ShapeStyle } from "@/app/_lib/shapes";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";
import { useUi } from "@/app/_lib/uiLang";
import CropFrame from "./CropFrame";

interface Props {
  /** The picture of the block, with what it was last edited with */
  editing: ImageEdit;
  /** The picture is redrawn from settings of its own (a figure of the library, another Studio): changed here, it becomes a plain picture */
  madeElsewhere?: boolean;
  /** Put the picture back in its block: what it was edited with, and the picture they make */
  onUpdate: (edit: ImageEdit, image: { src: string; ratio: number }) => void;
  onClose: () => void;
}

const PADDING = 24; // (room round the picture in the middle)
const DOCK_ROOM = 56; // (and under it, for the floating tool bar)
const MIN_SCALE = 0.1;
const MAX_SCALE = 3; // (a small picture is shown bigger, to draw on it)
// A text box drawn on the picture that was left empty goes away (it would be an invisible box)
const emptyTextBox = (s: ShapeItem | undefined) => !!s && !s.text?.trim() && s.fill === null && s.stroke === null;

// The shapes of frame the crop can keep (null = free)
// (the names are translated, the proportions are written as they are)
const RATIOS: { key: string; label: string; ratio: (w: number, h: number) => number | null; named?: boolean }[] = [
  { key: "free", label: "Free", ratio: () => null, named: true },
  { key: "original", label: "Original", ratio: (w, h) => w / h, named: true },
  { key: "square", label: "Square", ratio: () => 1, named: true },
  { key: "4:3", label: "4:3", ratio: () => 4 / 3 },
  { key: "3:4", label: "3:4", ratio: () => 3 / 4 },
  { key: "16:9", label: "16:9", ratio: () => 16 / 9 },
];

// The Image Studio: a picture of the page, to draw on and to crop. The picture in the middle, with the floating tool bar of the page under
// it (select, draw, text box, eraser, math keyboard) as in the other Studios; Crop shows the whole picture with a frame to drag round the
// part kept. The properties of the drawing selected, or the crop, on the right. The picture before, the crop and the drawings stay in the
// block: opened again, all of it can still be changed. Its own undo and redo; the exam's history gets one step on Update.
export default function ImageStudio({ editing, madeElsewhere = false, onUpdate, onClose }: Props) {
  const { t } = useUi();
  const { base, width: W, height: H } = editing;
  const [history, setHistory] = useState<StudioHistory<ImageEditDoc>>(() => startStudioHistory<ImageEditDoc>({ crop: editing.crop, shapes: editing.shapes }));
  const doc = history.present;
  const dirty = isStudioDirty(history);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const edit = useCallback((fn: (d: ImageEditDoc) => ImageEditDoc, key: string) => setHistory((h) => editStudioHistory(h, fn(h.present), key, Date.now())), []);
  const undo = () => setHistory(undoStudioHistory);
  const redo = () => setHistory(redoStudioHistory);

  // ---- the crop ----
  const [cropping, setCropping] = useState(false);
  const [ratioKey, setRatioKey] = useState("free");
  const crop = doc.crop ?? fullCrop(W, H);
  const cropped = !!doc.crop;
  const ratio = RATIOS.find((r) => r.key === ratioKey)?.ratio(W, H) ?? null;
  const setCrop = (c: CropRect, key: string) => edit((d) => ({ ...d, crop: isFullCrop(c, W, H) ? undefined : roundCrop(c) }), key);
  const pickRatio = (key: string) => {
    setRatioKey(key);
    const r = RATIOS.find((x) => x.key === key)?.ratio(W, H);
    if (r) setCrop(fitRatio(crop, r, W, H), `crop-ratio:${newShapeId()}`);
  };

  // ---- the floating tool bar and what it draws on the picture ----
  const ink = useInkTools(); // (the page's Draw tool: the same brush, pencil and highlighter, kept between sessions)
  const eraser = useEraserTool(); // (the page's Eraser)
  const [tool, setToolState] = useState<TableTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textId, setTextId] = useState<string | null>(null); // the drawing whose text is being typed
  const shapes = useMemo(() => doc.shapes ?? [], [doc.shapes]);
  const selectedShape = cropping ? null : (shapes.find((s) => s.id === selectedId) ?? null); // (what undo took away is no longer selected)
  const setTool = (next: TableTool) => {
    setToolState(next);
    if (next !== "select") setSelectedId(null);
  };
  const setShapes = (fn: (list: ShapeItem[]) => ShapeItem[], key: string) =>
    edit((d) => {
      const left = fn(d.shapes ?? []);
      return { ...d, shapes: left.length ? left : undefined };
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
  const textStyle = useMemo<Partial<ShapeStyle>>(() => ({ fontSize: 16, textAlign: "left", textVAlign: "top" }), []);

  const startCrop = () => {
    setTool("select");
    setSelectedId(null);
    setTextId(null);
    setCropping(true);
  };

  // The picture is shown whole (the part kept, or all of it while cropping): fitted to the window, bigger when it is small.
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRoom({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown = cropping ? { w: W, h: H } : { w: crop.w, h: crop.h };
  const fit = room.w > 0 && room.h > 0 ? Math.min((room.w - 2 * PADDING) / shown.w, (room.h - 2 * PADDING - DOCK_ROOM) / shown.h) : 1;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
  // (while cropping, the drawings are shown as they are, over the whole picture)
  const drawings = useMemo(() => (cropping && shapes.length ? svgUrl(drawingsSvg({ shapes }, fullCrop(W, H), W, H)) : null), [cropping, shapes, W, H]);

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());
  const update = async () => {
    const result: ImageEdit = { base, width: W, height: H, ...(doc.crop ? { crop: doc.crop } : {}), ...(doc.shapes?.length ? { shapes: doc.shapes } : {}) };
    setSaving(true);
    setFailed(false);
    try {
      onUpdate(result, await renderEditedImage(result));
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  // Esc ends the crop, puts the tool down, lets go of the drawing selected, then closes (asking first when something changed); a field
  // being typed in only loses the focus. Enter ends the crop. Delete removes the drawing selected. Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return el.blur();
        if (cropping) setCropping(false);
        else if (tool !== "select") setTool("select");
        else if (selectedShape) setSelectedId(null);
        else requestClose();
      } else if (typing) {
        return;
      } else if (e.key === "Enter" && cropping) {
        e.preventDefault();
        setCropping(false);
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
  const iconButton = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";
  const choice = (on: boolean) => `h-7 rounded-[5px] border px-1 text-[11px] transition-colors ${on ? "border-accent font-semibold text-accent" : "border-line text-ink hover:border-faint"}`;
  const button = "flex h-8 items-center justify-center gap-1.5 rounded-[5px] border border-line bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-40";

  return (
    <div data-testid="image-studio" className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...header} className={`${header.className} gap-2! py-1.5!`}>
        <h2 className="shrink-0 text-sm font-semibold text-ink">{t("Image Studio")}</h2>
        <div className="mx-1 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndoStudio(history)} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedoStudio(history)} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={15} />
        </button>
        <div className="mx-1 h-5 w-px bg-line" />
        <button
          onClick={() => (cropping ? setCropping(false) : startCrop())}
          aria-pressed={cropping}
          title={t("Crop the picture")}
          data-testid="crop-toggle"
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors ${cropping ? "bg-accent text-white" : "text-ink hover:bg-hover"}`}
        >
          <Crop size={14} aria-hidden />
          {t("Crop")}
        </button>
        {failed && (
          <p role="alert" className="ms-2 truncate text-xs text-red-700">
            {t("The picture could not be made. Try again.")}
          </p>
        )}
        <button onClick={() => void update()} disabled={saving} data-testid="insert" className="ms-auto h-7 shrink-0 rounded bg-accent px-3 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-40">
          {t("Update")}
        </button>
        <button onClick={requestClose} className="grid size-7 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col bg-subtle">
          <div ref={area} className="grid min-h-0 flex-1 place-items-center overflow-auto p-6 pb-20">
            {cropping ? (
              <div dir="ltr" className="relative bg-white shadow-sm" style={{ width: W * scale, height: H * scale }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the block's own picture (a data URL) */}
                <img src={base} alt="" draggable={false} className="absolute inset-0 block size-full select-none" />
                {/* eslint-disable-next-line @next/next/no-img-element -- the drawings, as they will be on the picture */}
                {drawings && <img src={drawings} alt="" draggable={false} className="pointer-events-none absolute inset-0 block size-full select-none" />}
                <CropFrame width={W} height={H} scale={scale} crop={crop} ratio={ratio} onChange={setCrop} />
              </div>
            ) : (
              <div dir="ltr" className="relative overflow-hidden bg-white shadow-sm" style={{ width: crop.w * scale, height: crop.h * scale }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the block's own picture (a data URL) */}
                <img
                  src={base}
                  alt=""
                  data-testid="image-preview"
                  draggable={false}
                  className="absolute block max-w-none select-none"
                  style={{ left: -crop.x * scale, top: -crop.y * scale, width: W * scale, height: H * scale }}
                />
                {/* the drawings, shapes and text boxes of the floating bar, over the part kept */}
                {/* (the wrapper lets the mouse through: the layer itself takes it only with a drawing tool or over a drawing) */}
                <div className="pointer-events-none absolute left-0 top-0">
                  <TableDrawingLayer
                    width={crop.w}
                    rowsHeight={crop.h}
                    roomBelow={0}
                    clip
                    offset={{ x: -crop.x, y: -crop.y }}
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
            )}
          </div>
          {/* the floating tool bar of the page: select, draw (brush, pencil, highlighter), text box, eraser, math keyboard */}
          {!cropping && <TableToolDock tool={tool} onTool={setTool} ink={ink} eraser={eraser} textboxHint={t("Text box: drag on the picture to draw one, then type")} />}
        </main>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-line bg-white ltr:border-l rtl:border-r" data-testid="image-panel">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{t("Properties")}</h3>
          {cropping ? (
            <Section title={t("Crop")}>
              <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t("Shape of the frame")}>
                {RATIOS.map((r) => (
                  <button key={r.key} type="button" role="radio" aria-checked={ratioKey === r.key} data-testid={`ratio-${r.key}`} onClick={() => pickRatio(r.key)} className={choice(ratioKey === r.key)}>
                    {r.named ? t(r.label) : r.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted tabular-nums" dir="ltr">
                {Math.round(crop.w)} × {Math.round(crop.h)} px
              </p>
              <p className="text-xs leading-snug text-muted">{t("Drag the frame, its corners or its sides: what is outside it is cut away.")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCrop(fullCrop(W, H), `crop-reset:${newShapeId()}`)} disabled={!cropped} data-testid="crop-reset" className={button}>
                  {t("Reset")}
                </button>
                <button type="button" onClick={() => setCropping(false)} data-testid="crop-done" className={`${button} border-accent! bg-accent! text-white! hover:bg-accent-strong!`}>
                  {t("Done")}
                </button>
              </div>
            </Section>
          ) : selectedShape ? (
            <ShapeProperties
              key={selectedShape.id}
              item={selectedShape}
              geometry
              onChange={(patch) => setShapes((list) => updateShape(list, selectedShape.id, patch), `shape:${selectedShape.id}:${Object.keys(patch).sort().join(",")}`)}
              onOrder={(order) => setShapes((list) => reorderShape(list, selectedShape.id, order), `order:${selectedShape.id}:${newShapeId()}`)}
              onDuplicate={() => {
                const { copy } = duplicateShape(shapes, selectedShape.id);
                if (!copy) return;
                setShapes((list) => addShape(list, copy), `dup:${copy.id}`);
                setSelectedId(copy.id);
              }}
              onDelete={() => deleteShape(selectedShape.id)}
            />
          ) : (
            <Section title={t("Picture")}>
              <p className="text-xs leading-snug text-muted">{t("Draw or write on the picture with the bar under it, or crop it.")}</p>
              {madeElsewhere && (
                <p role="note" data-testid="made-elsewhere" className="rounded-[5px] bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-800 ring-1 ring-amber-200">
                  {t("This picture is made from its own settings (a library figure or another Studio). Once cropped or drawn on here, it becomes a plain picture: those settings can no longer change it.")}
                </p>
              )}
              <button type="button" onClick={startCrop} data-testid="crop-start" className={button}>
                <Crop size={14} aria-hidden />
                {t("Crop the picture")}
              </button>
              {cropped && (
                <button type="button" onClick={() => setCrop(fullCrop(W, H), `crop-reset:${newShapeId()}`)} data-testid="crop-clear" className={button}>
                  {t("Show the whole picture again")}
                </button>
              )}
              {shapes.length > 0 && (
                <button type="button" onClick={() => setShapes(() => [], `clear:${newShapeId()}`)} data-testid="clear-drawings" className={`${button} text-red-700 hover:border-red-300! hover:bg-red-50!`}>
                  {t("Remove all the drawings")}
                </button>
              )}
            </Section>
          )}
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 px-4 py-3">
      <h4 className="text-xs font-semibold text-ink">{title}</h4>
      {children}
    </section>
  );
}

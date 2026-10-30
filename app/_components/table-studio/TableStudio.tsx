"use client";

import { ArrowLeft, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import StudioDock from "@/app/_components/StudioDock";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import TableFormatBar from "@/app/_components/table/TableFormatBar";
import TableGrid from "@/app/_components/table/TableGrid";
import TableSettings from "@/app/_components/table/TableSettings";
import { makeActions } from "@/app/_components/table/tableActions";
import { clampSel, selRange, type Sel } from "@/app/_components/table/tableSel";
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { FREEHAND_ID, addShape, duplicateShape, isLine, newShapeItem, removeShape, reorderShape, updateShape, type DrawnBox, type Order, type ShapeStyle } from "@/app/_lib/shapes";
import { anchorOf, colsOf, rowsOf, tableMirrored, wholeMerges } from "@/app/_lib/table";
import type { ExamMeta, TableBlock } from "@/app/_lib/types";
import { useUi } from "@/app/_lib/uiLang";
import { blankStudioTable, studioTableOf } from "./tablePreset";
import TablePreview from "./TablePreview";
import TableShapesCanvas from "./TableShapesCanvas";
import { useTableStudio, type StudioTable } from "./useTableStudio";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";

interface Props {
  meta: ExamMeta;
  /** The table block being edited (null = a new table) */
  editing: TableBlock | null;
  /** Open on the shapes, with this shape ready to draw (from the Shapes button of the right panel) */
  startShape?: string;
  /** Put the table on the page (a new table block, with everything the Studio made) */
  onInsert: (table: StudioTable) => void;
  /** Put the table back in the block it came from */
  onUpdate: (table: StudioTable) => void;
  onClose: () => void;
}

// The Table Studio: a full-screen spreadsheet for the table of an exam: cells to type in, select, copy and paste (also from Excel),
// merge and fill; looks, lines, fonts, number formats and formulas; shapes drawn over the table; and what is true of the whole table on the
// right, under a preview of how the page will draw it. What is inserted is an ordinary table block, so it can be changed again from the right
// panel, with the same tools, or here (the block's panel has a button back to the Studio).
export default function TableStudio({ meta, editing, startShape, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl } = useUi();
  const lang = meta.lang;
  const studio = useTableStudio(editing ? studioTableOf(editing) : blankStudioTable(CONTENT_WIDTH));
  const { table, apply, undo, redo, canUndo, canRedo, dirty } = studio;
  const [picked, setSel] = useState<Sel | null>(null);
  const [mode, setMode] = useState<"cells" | "shapes">(startShape ? "shapes" : "cells");
  const [shapeTool, setShapeTool] = useState<string | null>(startShape ?? null); // the shape the next drag draws
  const [shapeId, setShapeId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const sel = clampSel(picked, rowsOf(table), colsOf(table));
  const range = sel ? wholeMerges(table, selRange(sel)) : null;
  const active = sel ? anchorOf(table, sel.focus.r, sel.focus.c) : null;
  const actions = makeActions(table, range, tableMirrored(table, lang === "ar"), apply, setSel);
  const shapes = useMemo(() => table.shapes ?? [], [table.shapes]);
  const shape = shapes.find((s) => s.id === shapeId) ?? null; // (what undo took away is no longer selected)

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // ---- shapes ----

  const pickShape = (kind: string) => {
    setMode("shapes");
    setShapeTool(kind);
    setShapeId(null);
  };
  const changeShape = (id: string, patch: Parameters<typeof updateShape>[2], key: string) => apply({ shapes: updateShape(shapes, id, patch) }, key);
  const drawShape = (box: DrawnBox, style?: Partial<ShapeStyle>) => {
    if (!shapeTool) return;
    const item = newShapeItem(shapeTool, box, style);
    apply({ shapes: addShape(shapes, item) }, `add:${item.id}`);
    if (shapeTool === FREEHAND_ID) return; // (the pencil stays in hand: a drawing is many strokes)
    setShapeId(item.id);
    setShapeTool(null); // (like PowerPoint: one shape, then the Select tool is back)
  };
  const deleteShape = (id: string) => {
    apply({ shapes: removeShape(shapes, id).length ? removeShape(shapes, id) : undefined }, `remove:${id}`);
    setShapeId(null);
  };
  const orderShape = (id: string, order: Order) => apply({ shapes: reorderShape(shapes, id, order) }, `order:${id}:${Date.now()}`);
  const copyShape = (id: string) => {
    const { list, copy } = duplicateShape(shapes, id);
    if (!copy) return;
    apply({ shapes: list }, `dup:${copy.id}`);
    setShapeId(copy.id);
  };
  const backToCells = () => {
    setMode("cells");
    setShapeTool(null);
    setShapeId(null);
  };

  // Esc closes (asking first if there are changes), unless a cell is being typed in, a menu is open, or a selection is let go of (they
  // take the key themselves); in the shapes it puts the shape down, lets go of the selected one, then goes back to the cells. Ctrl+Z undoes and
  // Ctrl+Y redoes when the focus is not in a field. Delete, the arrows and R work on the selected shape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return;
        if (mode === "shapes") {
          if (shapeTool) setShapeTool(null);
          else if (shapeId) setShapeId(null);
          else backToCells();
        } else requestClose();
      } else if ((e.ctrlKey || e.metaKey) && !typing && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      } else if (mode === "shapes" && shape && !typing) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteShape(shape.id);
        } else if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          changeShape(shape.id, { x: shape.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0), y: shape.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0) }, `shape-move:${shape.id}`);
        } else if (key === "r" && !e.ctrlKey && !e.metaKey && !isLine(shape)) {
          e.preventDefault();
          changeShape(shape.id, { rotation: ((((shape.rotation ?? 0) + (e.shiftKey ? -90 : 90)) % 360) + 360) % 360 || undefined }, `shape-turn:${shape.id}:${Date.now()}`);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, dirty, undo, redo, onClose, mode, shapeTool, shapeId, shape, shapes]);

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";
  const shapesMode = mode === "shapes";
  const pencil = shapeTool === FREEHAND_ID;

  return (
    <div data-testid="table-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...studioHeaderProps()}>
        <h2 className="shrink-0 text-base font-semibold text-ink">{t("Table Studio")}</h2>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">{t("Spreadsheet")}</span>
        <div className="mx-2 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={16} />
        </button>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-muted lg:block">{t("Click a cell and type · Enter edits · Tab moves right · drag the square of the selection to fill · right-click for rows and columns")}</p>
        <button onClick={() => (editing ? onUpdate(table) : onInsert(table))} data-testid="insert" className="ms-auto shrink-0 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col">
          {shapesMode ? (
            <>
              <div data-testid="table-shapes-bar" className="flex items-center gap-2 border-b border-line bg-white px-2 py-1.5">
                <button type="button" onClick={backToCells} data-testid="back-to-cells" className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft">
                  <ArrowLeft size={14} className="rtl:rotate-180" />
                  {t("Back to the cells")}
                </button>
                <ShapesMenuButton variant="icon" active={!!shapeTool && !pencil} current={pencil ? null : shapeTool} onPick={pickShape} testId="table-shapes" />
                <p className="min-w-0 flex-1 truncate text-xs text-muted">
                  {pencil ? t("Drag on the table to draw freely · Esc to stop") : shapeTool ? t("Drag on the table to draw the shape (Shift: a square or a 45° line, Alt: from the centre), or click to put it at its usual size · Esc to stop") : t("Click a shape to change it · choose another one with the Shapes button")}
                </p>
              </div>
              <TableShapesCanvas table={table} meta={meta} tool={shapeTool} selectedId={shapeId} onSelect={setShapeId} onChange={changeShape} onDraw={drawShape} />
            </>
          ) : (
            <>
              <TableFormatBar table={table} range={range} active={active} actions={actions} examFont={meta.fontFamily ?? DEFAULT_FONT} onPickShape={pickShape} />
              <TableGrid table={table} lang={lang} sel={sel} onSelect={setSel} onChange={apply} onUndo={undo} onRedo={redo} actions={actions} examFont={meta.fontFamily} />
            </>
          )}
          {/* the floating toolbar: the pencil draws freely over the table (in the shapes), Select puts it down */}
          <StudioDock pencil={pencil} selecting={!shapeTool} onSelect={() => setShapeTool(null)} onPencil={() => (pencil ? setShapeTool(null) : pickShape(FREEHAND_ID))} hint={t("Pencil: draw freely over the table")} />
        </main>

        <aside className="flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-line bg-white p-4 ltr:border-l rtl:border-r">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("How it will look on the page")}</h3>
            <TablePreview table={table} meta={meta} boxWidth={280} />
          </section>
          {shapesMode && shape ? (
            <section className="-mx-4 border-t border-line">
              <ShapeProperties
                key={shape.id}
                item={shape}
                geometry
                onChange={(patch) => changeShape(shape.id, patch, `shape:${shape.id}:${Object.keys(patch).sort().join(",")}`)}
                onOrder={(order) => orderShape(shape.id, order)}
                onDuplicate={() => copyShape(shape.id)}
                onDelete={() => deleteShape(shape.id)}
              />
            </section>
          ) : (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Table")}</h3>
              <TableSettings table={table} onChange={apply} width={{ value: table.width, max: CONTENT_WIDTH, onChange: studio.setWidth }} />
            </section>
          )}
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

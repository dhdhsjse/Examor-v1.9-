"use client";

import { Redo2, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import TableFormatBar from "@/app/_components/table/TableFormatBar";
import TableGrid from "@/app/_components/table/TableGrid";
import TableSettings from "@/app/_components/table/TableSettings";
import { makeActions } from "@/app/_components/table/tableActions";
import { clampSel, selRange, type Sel } from "@/app/_components/table/tableSel";
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { layoutTable } from "@/app/_lib/blockLayout";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { pickImage } from "@/app/_lib/images";
import { eraseStrokes } from "@/app/_lib/ink/eraser";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import { FREEHAND_ID, addShape, newPictureItem, newShapeId, duplicateShape, isLine, isPicture, removeShape, reorderShape, updateShape, type Order, type ShapeItem, type ShapeStyle } from "@/app/_lib/shapes";
import { anchorOf, colsOf, rowsOf, tableMirrored, wholeMerges } from "@/app/_lib/table";
import type { ExamMeta, TableBlock } from "@/app/_lib/types";
import { useUi } from "@/app/_lib/uiLang";
import { blankStudioTable, studioTableOf } from "./tablePreset";
import TableDrawingLayer, { type TableTool } from "./TableDrawingLayer";
import TableToolDock from "./TableToolDock";
import { useTableStudio, type StudioTable } from "./useTableStudio";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";

interface Props {
  meta: ExamMeta;
  /** The table block being edited (null = a new table) */
  editing: TableBlock | null;
  /** Open with this shape ready to draw (from the Shapes button of the right panel) */
  startShape?: string;
  /** Put the table on the page (a new table block, with everything the Studio made) */
  onInsert: (table: StudioTable) => void;
  /** Put the table back in the block it came from */
  onUpdate: (table: StudioTable) => void;
  onClose: () => void;
}

// A text box drawn on the table that was left empty goes away (it would be an invisible box).
const emptyTextBox = (s: ShapeItem | undefined) => !!s && !s.text?.trim() && s.fill === null && s.stroke === null;

// The Table Studio: a full-screen spreadsheet for the table of an exam: cells to type in, select, copy and paste (also from Excel),
// merge and fill; looks, lines, fonts, number formats and formulas. The cells are drawn at the sizes the page gives them, and what is
// drawn over the table (the brush, pencil and highlighter of the floating bar, shapes, text boxes) is drawn right on them, where the page
// will show it. What is true of the whole table, or of the selected shape, is on the right. What is inserted is an ordinary table
// block, so it can be changed again from the right panel, with the same tools, or here (the block's panel has a button back to the Studio).
export default function TableStudio({ meta, editing, startShape, onInsert, onUpdate, onClose }: Props) {
  const { t } = useUi();
  const lang = meta.lang;
  const studio = useTableStudio(editing ? studioTableOf(editing) : blankStudioTable(CONTENT_WIDTH));
  const { table, apply, undo, redo, canUndo, canRedo, dirty } = studio;
  const ink = useInkTools(); // (the page's Draw tool: the same brush, pencil and highlighter, kept between sessions)
  const eraser = useEraserTool(); // (the page's Eraser: the same way of rubbing and size)
  const [picked, setSel] = useState<Sel | null>(null);
  const [tool, setTool] = useState<TableTool>(startShape ? (startShape === FREEHAND_ID ? "draw" : "shape") : "select");
  const [shapeKind, setShapeKind] = useState(startShape && startShape !== FREEHAND_ID ? startShape : "rect"); // the shape the Shapes tool draws
  const [shapeId, setShapeId] = useState<string | null>(null);
  const [textId, setTextId] = useState<string | null>(null); // the shape whose text is being typed on the table
  const [confirmClose, setConfirmClose] = useState(false);
  const sel = clampSel(picked, rowsOf(table), colsOf(table));
  const range = sel ? wholeMerges(table, selRange(sel)) : null;
  const active = sel ? anchorOf(table, sel.focus.r, sel.focus.c) : null;
  const actions = makeActions(table, range, tableMirrored(table, lang === "ar"), apply, setSel);
  const shapes = useMemo(() => table.shapes ?? [], [table.shapes]);
  const shape = shapes.find((s) => s.id === shapeId) ?? null; // (what undo took away is no longer selected)

  // The table as the page lays it out: the cells are drawn at its sizes, and the drawing over them in its pixels.
  const layout = useMemo(() => {
    const { width, ...data } = table;
    return layoutTable({ ...data, id: "studio", type: "table", layout: { pageId: "p", x: 0, y: 0, width, height: 0 } }, meta);
  }, [table, meta]);
  const textStyle = useMemo<Partial<ShapeStyle>>(
    () => ({ fontFamily: table.font?.family ?? meta.fontFamily, fontSize: layout.F.body.font.size, textAlign: lang === "ar" ? "right" : "left", textVAlign: "top" }),
    [table.font?.family, meta.fontFamily, layout.F.body.font.size, lang],
  );

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // ---- tools and shapes ----

  const pickTool = (next: TableTool) => {
    setTool(next);
    if (next !== "select") setShapeId(null);
  };
  const pickShape = (kind: string) => {
    if (kind === FREEHAND_ID) return pickTool("draw");
    setShapeKind(kind);
    pickTool("shape");
  };
  // A cell picked: the shape is let go of (and the other way round), so the keys and the right panel are for one of them.
  const selectCells = (s: Sel | null) => {
    setSel(s);
    if (s) setShapeId(null);
  };
  const selectShape = (id: string | null) => {
    setShapeId(id);
    if (id) setSel(null);
  };
  // An image from the computer goes in the middle of the table, in its own proportions, selected to be moved and resized.
  const chooseImage = async () => {
    const picture = await pickImage();
    if (!picture) return;
    const item = newPictureItem(picture, { w: table.width, h: Math.max(layout.height, 60) });
    apply({ shapes: addShape(shapes, item) }, `add:${item.id}`);
    setTool("select");
    selectShape(item.id);
  };
  // Another image for a picture: it keeps its place and width, and takes the proportions of the new one.
  const replaceImage = async (id: string, width: number) => {
    const picture = await pickImage();
    if (picture) changeShape(id, { src: picture.src, h: Math.max(6, width / picture.ratio) }, `shape-image:${id}:${newShapeId()}`);
  };
  const changeShape = (id: string, patch: Parameters<typeof updateShape>[2], key: string) => apply({ shapes: updateShape(shapes, id, patch) }, key);
  const addItem = (item: ShapeItem) => {
    apply({ shapes: addShape(shapes, item) }, `add:${item.id}`);
    if (tool === "draw") return; // (the brush stays in hand: a drawing is many strokes)
    selectShape(item.id);
    setTool("select"); // (like PowerPoint: one shape, then the Select tool is back)
    if (tool === "textbox") setTextId(item.id); // (a text box: type in it at once)
  };
  const eraseShapes = (ids: ReadonlySet<string>, gesture: string) => {
    const left = (table.shapes ?? []).filter((s) => !ids.has(s.id));
    apply({ shapes: left.length ? left : undefined }, gesture);
  };
  // The real eraser: the drawings it went over are cut there (worked out from the table as it is at each move).
  const eraseInk = (path: { x: number; y: number }[], radius: number, gesture: string) =>
    studio.update((t) => {
      const left = eraseStrokes(t.shapes ?? [], path, radius, newShapeId);
      return left && { shapes: left.length ? left : undefined };
    }, gesture);
  const endText = (id: string | null) => {
    const typed = shapes.find((s) => s.id === textId);
    setTextId(id);
    if (!id && emptyTextBox(typed) && typed) deleteShape(typed.id, `add:${typed.id}`); // (the same step of the undo as drawing it)
  };
  const deleteShape = (id: string, key = `remove:${id}`) => {
    const left = removeShape(shapes, id);
    apply({ shapes: left.length ? left : undefined }, key);
    setShapeId(null);
  };
  const orderShape = (id: string, order: Order) => apply({ shapes: reorderShape(shapes, id, order) }, `order:${id}:${Date.now()}`);
  const copyShape = (id: string) => {
    const { list, copy } = duplicateShape(shapes, id);
    if (!copy) return;
    apply({ shapes: list }, `dup:${copy.id}`);
    setShapeId(copy.id);
  };

  // Esc closes (asking first if there are changes), unless a cell or a text is being typed in, a menu is open, or a selection is let go
  // of (they take the key themselves); with a drawing tool in hand it puts it down, then lets go of the selected shape. Ctrl+Z undoes and
  // Ctrl+Y redoes when the focus is not in a field. Delete, the arrows and R work on the selected shape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return;
        if (tool !== "select") setTool("select");
        else if (shapeId) setShapeId(null);
        else requestClose();
      } else if ((e.ctrlKey || e.metaKey) && !typing && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      } else if (shape && tool === "select" && !typing) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteShape(shape.id);
        } else if (e.key === "Enter" && !isLine(shape)) {
          e.preventDefault();
          setTextId(shape.id);
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
  }, [confirmClose, dirty, undo, redo, onClose, tool, shapeId, shape, shapes]);

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";
  const hint =
    tool === "draw"
      ? t("Drag on the table to draw freely · Esc to stop")
      : tool === "shape"
        ? t("Drag on the table to draw the shape (Shift: a square or a 45° line, Alt: from the centre), or click to put it at its usual size · Esc to stop")
        : tool === "textbox"
          ? t("Drag on the table to draw a text box, then type in it · Esc to stop")
          : tool === "eraser"
            ? t("Drag over a drawing or a shape to rub it out · Esc to stop")
            : t("Click a cell and type · Enter edits · Tab moves right · drag the square of the selection to fill · right-click for rows and columns");

  return (
    <div data-testid="table-studio" className="fixed inset-0 z-50 flex flex-col bg-white">
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
        <p data-testid="studio-hint" className="hidden min-w-0 flex-1 truncate text-xs text-muted lg:block">
          {hint}
        </p>
        <button onClick={() => (editing ? onUpdate(table) : onInsert(table))} data-testid="insert" className="ms-auto shrink-0 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col">
          <TableFormatBar table={table} range={range} active={active} actions={actions} examFont={meta.fontFamily ?? DEFAULT_FONT} onPickShape={pickShape} onPickImage={chooseImage} shapesActive={tool === "shape"} />
          <TableGrid
            table={table}
            lang={lang}
            sel={sel}
            onSelect={selectCells}
            onChange={apply}
            onUndo={undo}
            onRedo={redo}
            actions={actions}
            examFont={meta.fontFamily}
            page={{
              layout,
              width: table.width,
              overlay: (scale) => (
                <TableDrawingLayer
                  width={table.width}
                  rowsHeight={layout.height}
                  scale={scale}
                  shapes={shapes}
                  tool={tool}
                  shapeKind={shapeKind}
                  ink={ink}
                  textStyle={textStyle}
                  selectedId={shapeId}
                  editingId={textId}
                  onSelect={selectShape}
                  onChange={changeShape}
                  onAdd={addItem}
                  eraser={eraser}
                  onErase={eraseShapes}
                  onEraseInk={eraseInk}
                  onEdit={endText}
                />
              ),
            }}
          />
          {/* the floating tool bar: what it draws goes on the table */}
          <TableToolDock tool={tool} onTool={pickTool} ink={ink} eraser={eraser} />
        </main>

        <aside className="flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-line bg-white p-4 ltr:border-l rtl:border-r">
          {shapes.length > 0 && (
            <div role="note" data-testid="table-fixed-warning" className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="flex flex-col gap-1.5">
                <p className="font-semibold">{t("The table will be fixed")}</p>
                <p>{t("With shapes or images, the table is fixed like a picture once it is inserted: it can no longer be changed from the page or the right panel, only here in the Table Studio. After changing the data, check that the shapes still fit.")}</p>
                <button type="button" onClick={() => apply({ shapes: undefined }, "remove-all")} data-testid="remove-all-shapes" className="flex w-fit items-center gap-1.5 text-xs font-medium text-amber-900 underline">
                  <Trash2 size={12} />
                  {t("Remove all shapes and images")}
                </button>
              </div>
            </div>
          )}
          {shape ? (
            <section className="-mx-4 -mt-4">
              <ShapeProperties
                key={shape.id}
                item={shape}
                geometry
                onChange={(patch) => changeShape(shape.id, patch, `shape:${shape.id}:${Object.keys(patch).sort().join(",")}`)}
                onOrder={(order) => orderShape(shape.id, order)}
                onDuplicate={() => copyShape(shape.id)}
                onDelete={() => deleteShape(shape.id)}
                onReplaceImage={isPicture(shape) ? () => replaceImage(shape.id, shape.w) : undefined}
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

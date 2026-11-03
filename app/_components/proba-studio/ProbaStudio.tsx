"use client";

import { Copy, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import type { TableTool } from "@/app/_components/table-studio/TableDrawingLayer";
import TableToolDock from "@/app/_components/table-studio/TableToolDock";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import { DEFAULT_PROBA_CONFIG, type ProbaConfig } from "@/app/_lib/proba/types";
import { isLine } from "@/app/_lib/shapes";
import { useUi } from "@/app/_lib/uiLang";
import ProbaCanvas from "./ProbaCanvas";
import ProbaPanel from "./ProbaPanel";
import ProbaToolbar from "./ProbaToolbar";
import { isPlaceTool, useProbaStudio } from "./useProbaStudio";

interface Props {
  /** The drawing of the block being edited; null = a new one. */
  editing: ProbaConfig | null;
  /** Put the drawing on the page (a new block). */
  onInsert: (config: ProbaConfig) => void;
  /** Put the drawing back in the block it came from. */
  onUpdate: (config: ProbaConfig) => void;
  onClose: () => void;
}

type Inline = { tree: string; node: string };

// The Probability Studio: a full-screen modal laid out like the Circuit Studio, with the quick tree builder and the figures on
// the left, the sheet in the middle (with the floating tool bar of the page: select, draw, text box, eraser, math keyboard) and
// the properties on the right. The drawing lives in this Studio only (useProbaStudio, with its own undo and redo): the exam's
// undo history gets one step when it is inserted or updated.
export default function ProbaStudio({ editing, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl, lang } = useUi();
  const studio = useProbaStudio(editing ?? DEFAULT_PROBA_CONFIG, lang === "en" ? ["H", "T"] : ["P", "F"]);
  const { config, tool, selection, selectedTree, selectedNode, selectedShape, selectedItem, undo, redo, canUndo, canRedo, dirty, empty } = studio;
  const ink = useInkTools(); // (the page's Draw tool: the same brush, pencil and highlighter, kept between sessions)
  const eraser = useEraserTool(); // (the page's Eraser)
  const [confirmClose, setConfirmClose] = useState(false);
  const [inline, setInline] = useState<Inline | null>(null);

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // Esc backs out one level at a time: puts the tool down, lets go of the selection, closes. Delete removes what is selected (a
  // branch with what follows it). With an event of a tree selected: Tab adds a branch after it (it stays selected), F2 renames it.
  // The arrows move the selected item (Shift: by ten). Ctrl+D duplicates; Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return;
        if (tool !== "select") studio.setTool("select");
        else if (selection) studio.clearSelection();
        else requestClose();
        return;
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && key === "d" && selectedItem) {
        e.preventDefault();
        studio.duplicate();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        studio.deleteSelected();
      } else if (selectedTree && selectedNode && e.key === "Tab") {
        e.preventDefault();
        studio.branch(selectedTree.id, selectedNode.id); // (the event stays selected: Tab again adds the next one)
      } else if (selectedTree && selectedNode && e.key === "F2") {
        e.preventDefault();
        setInline({ tree: selectedTree.id, node: selectedNode.id });
      } else if (e.key.startsWith("Arrow") && tool === "select" && (selectedItem || selectedShape)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (selectedItem) studio.nudgeItem(selectedItem.id, dx, dy);
        else if (selectedShape) studio.changeShape(selectedShape.id, { x: selectedShape.x + dx, y: selectedShape.y + dy }, `shape-move:${selectedShape.id}`);
      } else if (key === "r" && !e.ctrlKey && !e.metaKey && selectedShape && !isLine(selectedShape)) {
        e.preventDefault();
        studio.changeShape(selectedShape.id, { rotation: ((((selectedShape.rotation ?? 0) + (e.shiftKey ? -90 : 90)) % 360) + 360) % 360 || undefined }, `shape-turn:${selectedShape.id}:${Date.now()}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, dirty, tool, selection, selectedTree, selectedNode, selectedItem, selectedShape, undo, redo, onClose, studio.branch, studio.nudgeItem, studio.changeShape, studio.deleteSelected, studio.duplicate]);

  const hint =
    tool === "draw"
      ? t("Drag on the drawing to draw freely · Esc to stop")
      : tool === "shape"
        ? t("Drag on the drawing to draw the shape (Shift: a square or a 45° line, Alt: from the centre), or click to put it at its usual size · Esc to stop")
        : tool === "textbox"
          ? t("Drag on the drawing to draw a text box, then type in it · Esc to stop")
          : tool === "eraser"
            ? t("Drag over a drawing or a shape to rub it out · Esc to stop")
            : isPlaceTool(tool)
              ? t("Click the drawing to put it there · Esc to stop")
              : selectedTree
                ? t("Double-click an event to rename it · Tab: a branch after the selected event · Delete: remove it")
                : t("Click something to select it, drag it to move it");

  const iconButton = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";
  const dockTool: TableTool = isPlaceTool(tool) ? "select" : tool;
  const header = studioHeaderProps();

  return (
    <div data-testid="proba-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* the shared studio header, slimmer here (40px) */}
      <header {...header} className={`${header.className} gap-2! py-1.5!`}>
        <h2 className="shrink-0 text-sm font-semibold text-ink">{t("Probability Studio")}</h2>

        <div className="mx-1 h-4 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={15} />
        </button>
        <p data-testid="studio-hint" className="ms-2 hidden min-w-0 flex-1 truncate text-xs text-muted lg:block">
          {hint}
        </p>

        <button
          onClick={() => (editing ? onUpdate(config) : onInsert(config))}
          disabled={empty}
          title={empty ? t("Nothing to insert yet: draw something first.") : undefined}
          data-testid="insert"
          className="ms-auto h-7 shrink-0 rounded bg-accent px-3 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className={iconButton} title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-48 shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l">
          <ProbaToolbar studio={studio} />
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <ProbaCanvas studio={studio} ink={ink} eraser={eraser} inlineRequest={inline} onInlineDone={() => setInline(null)} />
          {/* the floating tool bar of the page: select, draw (brush, pencil, highlighter), text box, eraser, math keyboard */}
          <TableToolDock tool={dockTool} onTool={(next) => studio.setTool(next)} ink={ink} eraser={eraser} textboxHint={t("Text box: drag on the drawing to draw one, then type")} />
        </main>

        <aside className="flex w-64 shrink-0 flex-col border-line bg-white ltr:border-l rtl:border-r">
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line ps-3 pe-1">
            <h3 className="text-xs font-semibold text-ink">{t("Properties")}</h3>
            {selectedItem && (
              <button onClick={studio.duplicate} title={`${t("Duplicate")} (Ctrl+D)`} aria-label={t("Duplicate")} data-testid="duplicate" className={iconButton}>
                <Copy size={14} />
              </button>
            )}
          </div>
          <ProbaPanel studio={studio} />
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

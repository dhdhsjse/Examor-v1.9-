"use client";

import { Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import TableToolDock from "@/app/_components/table-studio/TableToolDock";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import { DEFAULT_GRAPH_CONFIG, type GraphConfig } from "@/app/_lib/graph/types";
import { useUi } from "@/app/_lib/uiLang";
import GraphCanvas from "./GraphCanvas";
import GraphPanel from "./GraphPanel";
import GraphToolbar from "./GraphToolbar";
import { useGraphStudio, type GraphView } from "./useGraphStudio";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";

interface Props {
  /** The graph of the block being edited; null = a new graph. */
  editing: GraphConfig | null;
  /** Put the graph on the page (a new block). */
  onInsert: (config: GraphConfig, view: GraphView) => void;
  /** Put the graph back in the block it came from. */
  onUpdate: (config: GraphConfig, view: GraphView) => void;
  onClose: () => void;
}

// The Graph Studio: a full-screen modal laid out like the Molecule Studio, with the functions and the starting sheets on the left, the graph
// paper in the middle (with the floating tool bar of the page: select, draw, text box, eraser, math keyboard) and the axes and the
// grid on the right. The graph lives in this Studio only (useGraphStudio, with its
// own undo and redo): the exam's undo history gets one step when the graph is inserted or updated.
export default function GraphStudio({ editing, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl } = useUi();
  const studio = useGraphStudio(editing ?? DEFAULT_GRAPH_CONFIG);
  const { undo, redo, canUndo, canRedo, dirty, selected, selectedAnnotation, selectedShape, shapeTool, tool, pickTool, selectFunction, selectAnnotation, removeFunction, removeAnnotation } = studio;
  const { config, view, setView, masked } = studio;
  const student = view === "student"; // looking at what the students will see: nothing is edited
  const [confirmClose, setConfirmClose] = useState(false);
  const ink = useInkTools(); // (the page's Draw tool: the same brush, pencil and highlighter, kept between sessions)
  const eraser = useEraserTool(); // (the page's Eraser)
  const { inkTool, pickInkTool } = studio;

  // Closing with changes asks first.
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // Esc closes (asking first if there are changes); Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      if (student && e.key !== "Escape") return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      // Esc: puts the tool down, then lets go of the selection, then closes. Delete takes what is selected off the paper.
      if (e.key === "Escape") {
        if ((tool || shapeTool || inkTool) && !typing) pickTool(null);
        else if ((selected || selectedAnnotation || selectedShape) && !typing) {
          selectFunction(null);
          selectAnnotation(null);
        } else requestClose();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && (selected || selectedAnnotation || selectedShape)) {
        e.preventDefault();
        if (selected) removeFunction(selected.id);
        else if (selectedAnnotation) removeAnnotation(selectedAnnotation.id);
        else if (selectedShape) studio.removeShapeById(selectedShape.id);
      } else if (selectedShape && !typing && !tool && e.key.startsWith("Arrow")) {
        // a shape moves by a pixel (ten with Shift)
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        studio.nudgeShape(selectedShape.id, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      } else if (selectedShape && !typing && key === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        studio.turnShape(selectedShape.id, e.shiftKey ? -90 : 90);
      } else if ((e.ctrlKey || e.metaKey) && !typing && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, dirty, student, undo, redo, onClose, selected, selectedAnnotation, selectedShape, shapeTool, inkTool, tool, pickTool, selectFunction, selectAnnotation, removeFunction, removeAnnotation]);

  const iconButton = "grid size-8 place-items-center rounded-full text-muted transition-[transform,background-color,color] duration-100 ease-out outline-none enabled:hover:bg-subtle enabled:hover:text-ink enabled:active:scale-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40";

  return (
    <div data-testid="graph-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...studioHeaderProps()}>
        <h2 className="shrink-0 text-base font-semibold tracking-[-0.01em] text-ink">{t("Graph Studio")}</h2>

        <div className="mx-2 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={16} />
        </button>

        <div className="mx-2 flex gap-0.5 rounded-[10px] bg-subtle p-[3px]" role="group" aria-label={t("View")} data-testid="view-toggle">
          {(["teacher", "student"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              data-view={v}
              title={v === "teacher" ? t("Teacher view: everything is drawn, the hidden parts faded") : t("Student view: this is what the students will see")}
              className={`flex h-7 items-center rounded-[8px] px-3 text-xs tracking-[-0.005em] transition-[background-color,color,box-shadow,transform] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${view === v ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-muted hover:text-ink"}`}
            >
              {v === "teacher" ? t("Teacher view") : t("Student view")}
              {v === "student" && masked > 0 && <span className="ms-1.5 rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-strong tabular-nums">{masked}</span>}
            </button>
          ))}
        </div>

        <button
          onClick={() => (editing ? onUpdate(config, view) : onInsert(config, view))}
          data-testid="insert"
          className="ms-auto h-8 rounded-full bg-accent px-5 text-[13px] font-semibold tracking-[-0.01em] text-white transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.97]"
        >
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className={`${iconButton} shrink-0 bg-subtle`} title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`flex w-[280px] shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l ${student ? "pointer-events-none opacity-50" : ""}`}>
          <GraphToolbar studio={studio} />
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <GraphCanvas studio={studio} ink={ink} eraser={eraser} />
          {/* the floating tool bar of the page: select, draw (brush, pencil, highlighter), text box, eraser, math keyboard */}
          {!student && (
            <TableToolDock
              tool={inkTool ?? (shapeTool ? "shape" : "select")}
              onTool={(next) => (next === "select" || next === "shape" ? pickInkTool(null) : pickInkTool(next))}
              ink={ink}
              eraser={eraser}
              textboxHint={t("Text box: drag on the paper to draw one, then type")}
            />
          )}
        </main>

        <aside className={`flex w-[300px] shrink-0 flex-col border-line bg-white ltr:border-l rtl:border-r ${student ? "pointer-events-none opacity-50" : ""}`}>
          <GraphPanel studio={studio} />
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

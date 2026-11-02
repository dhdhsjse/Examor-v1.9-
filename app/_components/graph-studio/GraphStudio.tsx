"use client";

import { Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { StudioKeyboard, StudioKeyboardButton } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
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
// paper in the middle and the axes and the grid on the right. The graph lives in this Studio only (useGraphStudio, with its
// own undo and redo): the exam's undo history gets one step when the graph is inserted or updated.
export default function GraphStudio({ editing, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl } = useUi();
  const studio = useGraphStudio(editing ?? DEFAULT_GRAPH_CONFIG);
  const { undo, redo, canUndo, canRedo, dirty, selected, selectedAnnotation, selectedShape, shapeTool, tool, pickTool, selectFunction, selectAnnotation, removeFunction, removeAnnotation } = studio;
  const { config, view, setView, masked } = studio;
  const student = view === "student"; // looking at what the students will see: nothing is edited
  const [confirmClose, setConfirmClose] = useState(false);

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
        if ((tool || shapeTool) && !typing) pickTool(null);
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
  }, [confirmClose, dirty, student, undo, redo, onClose, selected, selectedAnnotation, selectedShape, shapeTool, tool, pickTool, selectFunction, selectAnnotation, removeFunction, removeAnnotation]);

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";

  return (
    <div data-testid="graph-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...studioHeaderProps()}>
        <h2 className="shrink-0 text-base font-semibold text-ink">{t("Graph Studio")}</h2>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">{t("Graph lab")}</span>

        <div className="mx-2 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={16} />
        </button>
        <StudioKeyboardButton />

        <div className="mx-1 flex rounded-lg bg-subtle p-0.5" role="group" aria-label={t("View")} data-testid="view-toggle">
          {(["teacher", "student"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              data-view={v}
              title={v === "teacher" ? t("Teacher view: everything is drawn, the hidden parts faded") : t("Student view: this is what the students will see")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${view === v ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {v === "teacher" ? t("Teacher view") : t("Student view")}
              {v === "student" && masked > 0 && <span className="ms-1.5 rounded-full bg-accent-soft px-1.5 text-[10px] tabular-nums text-accent-strong">{masked}</span>}
            </button>
          ))}
        </div>

        <button onClick={() => (editing ? onUpdate(config, view) : onInsert(config, view))} data-testid="insert" className="ms-auto rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`flex w-[280px] shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l ${student ? "pointer-events-none opacity-50" : ""}`}>
          <GraphToolbar studio={studio} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <GraphCanvas studio={studio} />
        </main>

        <aside className={`flex w-[300px] shrink-0 flex-col border-line bg-white ltr:border-l rtl:border-r ${student ? "pointer-events-none opacity-50" : ""}`}>
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{t("Properties")}</h3>
          <GraphPanel studio={studio} />
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

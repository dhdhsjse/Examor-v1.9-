"use client";

import { Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import StudioDock from "@/app/_components/StudioDock";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import { DEFAULT_CIRCUIT_CONFIG, type CircuitConfig } from "@/app/_lib/circuit/types";
import { FREEHAND_ID } from "@/app/_lib/shapes";
import { useUi } from "@/app/_lib/uiLang";
import CircuitCanvas from "./CircuitCanvas";
import CircuitPanel from "./CircuitPanel";
import CircuitToolbar from "./CircuitToolbar";
import { useCircuitStudio } from "./useCircuitStudio";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";

interface Props {
  /** The circuit of the block being edited; null = a new circuit. */
  editing: CircuitConfig | null;
  /** Put the circuit on the page (a new block). */
  onInsert: (config: CircuitConfig) => void;
  /** Put the circuit back in the block it came from. */
  onUpdate: (config: CircuitConfig) => void;
  onClose: () => void;
}

// The Circuit Studio: a full-screen modal laid out like the Molecule Studio, with the components and tools on the left, the
// drawing area in the middle and the properties on the right. The circuit lives in this Studio only (useCircuitStudio, with its
// own undo and redo): the exam's undo history gets one step when the circuit is inserted or updated.
export default function CircuitStudio({ editing, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl } = useUi();
  const studio = useCircuitStudio(editing ?? DEFAULT_CIRCUIT_CONFIG);
  const { config, tool, draft, selectedComponent, selectedWire, selectedShape, undo, redo, canUndo, canRedo, dirty, empty } = studio;
  const pencil = tool === "shape" && studio.shapeKind === FREEHAND_ID; // (the pencil draws a freehand shape)
  const anySelected = !!(selectedComponent || selectedWire || selectedShape);
  const [confirmClose, setConfirmClose] = useState(false);

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // Esc backs out one level at a time: ends the wire being drawn, puts the tool down, lets go of the selection, closes. Delete
  // removes what is selected, R turns it (or the component about to be placed), the arrows move a component by a cell, Enter
  // ends the wire. Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo. None of them while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return;
        if (draft) studio.finishWire();
        else if (tool !== "select") studio.setTool("select");
        else if (anySelected) studio.clearSelection();
        else requestClose();
      } else if (typing) {
        return;
      } else if (e.key === "Enter" && draft) {
        e.preventDefault();
        studio.finishWire();
      } else if ((e.key === "Delete" || e.key === "Backspace") && anySelected) {
        e.preventDefault();
        studio.deleteSelected();
      } else if (key === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        studio.rotate(e.shiftKey ? -90 : 90);
      } else if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      } else if (selectedComponent && tool === "select" && e.key.startsWith("Arrow")) {
        e.preventDefault();
        studio.nudge(selectedComponent.id, e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
      } else if (selectedShape && tool === "select" && e.key.startsWith("Arrow")) {
        // a shape moves by a pixel (ten with Shift)
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        studio.nudgeShape(selectedShape.id, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, dirty, draft, tool, selectedComponent, selectedWire, selectedShape, studio.finishWire, studio.setTool, studio.clearSelection, studio.deleteSelected, studio.rotate, studio.nudge, studio.nudgeShape, undo, redo, onClose]);

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";

  return (
    <div data-testid="circuit-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...studioHeaderProps()}>
        <h2 className="shrink-0 text-base font-semibold text-ink">{t("Circuit Studio")}</h2>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">{t("Circuit lab")}</span>

        <div className="mx-2 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={16} />
        </button>

        <button
          onClick={() => (editing ? onUpdate(config) : onInsert(config))}
          disabled={empty}
          title={empty ? t("Nothing to insert yet: draw something first.") : undefined}
          data-testid="insert"
          className="ms-auto rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l">
          <CircuitToolbar studio={studio} />
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <CircuitCanvas studio={studio} />
          {/* the floating toolbar: the pencil draws freely on the drawing, Select puts it down */}
          <StudioDock
            pencil={pencil}
            selecting={tool === "select"}
            onSelect={() => studio.setTool("select")}
            onPencil={() => (pencil ? studio.setTool("select") : studio.pickShape(FREEHAND_ID))}
            hint={t("Draw freely on the drawing with the mouse · Esc to stop")}
          />
        </main>

        <aside className="flex w-[300px] shrink-0 flex-col border-line bg-white ltr:border-l rtl:border-r">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{t("Properties")}</h3>
          <CircuitPanel studio={studio} />
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

"use client";

import { Crosshair, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { StudioKeyboard, StudioKeyboardButton } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import { tryCompile } from "@/app/_lib/graphMath";
import { addTangent, tangentAt } from "@/app/_lib/mathGraph";
import type { GraphBlock } from "@/app/_lib/types";
import { useUi } from "@/app/_lib/uiLang";
import FunctionsPanel from "./FunctionsPanel";
import GraphPreview from "./GraphPreview";
import WindowPanel from "./WindowPanel";
import { blankStudioGraph, studioGraphOf, type StudioGraph } from "./mathGraphPreset";
import { useMathGraphStudio } from "./useMathGraphStudio";

interface Props {
  /** The graph block being edited (null = a new graph) */
  editing: GraphBlock | null;
  /** Put the graph on the page (a new block) */
  onInsert: (graph: StudioGraph) => void;
  /** Put the graph back in the block it came from */
  onUpdate: (graph: StudioGraph) => void;
  onClose: () => void;
}

// The Function Studio: the simple way to make a graph of functions. Type one function or several (each can be hidden, colored, removed),
// and for each its derivative, its asymptotes and its tangents at the points you choose, with the graph in the middle moving and
// zooming under the mouse. What is inserted is an ordinary graph block, drawn by the page itself, that this Studio opens again (a
// double-click on it, or the button of its Properties panel).
export default function MathGraphStudio({ editing, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl } = useUi();
  const studio = useMathGraphStudio(editing ? studioGraphOf(editing) : blankStudioGraph());
  const { graph, apply, undo, redo, canUndo, canRedo, dirty } = studio;
  const [selected, setSelected] = useState(0);
  const [tangentTool, setTangentTool] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const current = Math.min(selected, graph.functions.length - 1);

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // A click on the graph with the tangent tool: the selected function gets a tangent there (nothing if it has none at that point).
  const tangentAtClick = (x: number) => {
    const fn = tryCompile(graph.functions[current] ?? "").fn;
    if (!fn || !tangentAt(fn, x)) return;
    const changes = addTangent(graph, current, x);
    if (changes) apply(changes, `tangent:${current}:${Date.now()}`);
  };

  // Esc puts the tangent tool down, then closes (asking first if there are changes), unless a field is being typed in; Ctrl+Z undoes and
  // Ctrl+Y redoes when the focus is not in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (typing) return;
        if (tangentTool) setTangentTool(false);
        else requestClose();
      } else if ((e.ctrlKey || e.metaKey) && !typing && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, dirty, undo, redo, onClose, tangentTool]);

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";

  return (
    <div data-testid="math-graph-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <h2 className="shrink-0 text-base font-semibold text-ink">{t("Function Studio")}</h2>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">{t("Curves")}</span>
        <div className="mx-2 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={16} />
        </button>
        <StudioKeyboardButton />
        <button
          type="button"
          onClick={() => setTangentTool((on) => !on)}
          aria-pressed={tangentTool}
          data-testid="tangent-tool"
          title={t("Click the graph to put a tangent there")}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${tangentTool ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink hover:border-accent"}`}
        >
          <Crosshair size={14} />
          {t("Tangent by click")}
        </button>
        <button onClick={() => (editing ? onUpdate(graph) : onInsert(graph))} data-testid="insert" className="ms-auto shrink-0 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[360px] shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{t("Functions")}</h3>
          <FunctionsPanel graph={graph} apply={apply} selected={current} onSelect={setSelected} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <GraphPreview graph={graph} selected={current} tangentTool={tangentTool} onWindow={(w) => apply(w, "window:drag")} onTangent={tangentAtClick} />
        </main>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-line bg-white ltr:border-l rtl:border-r">
          <WindowPanel graph={graph} apply={apply} />
        </aside>
      </div>

      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

"use client";

import { Redo2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SAMPLE_MOLECULES } from "@/app/_lib/chemistry/samples";
import { maskedCount, type StudioView } from "@/app/_lib/chemistry/masking";
import type { MoleculeGraph } from "@/app/_lib/chemistry/types";
import { useUi } from "@/app/_lib/uiLang";
import type { MoleculeBlockData, Representation } from "@/app/_molecule/model";
import { availableRepresentations } from "@/app/_molecule/render";
import { REP_LABEL, REP_SHORT } from "@/app/_molecule/strings";
import { StudioKeyboard, StudioKeyboardButton } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "./DiscardDialog";
import PeriodicTableDialog from "./PeriodicTableDialog";
import PropertiesPanel from "./PropertiesPanel";
import StudioCanvas from "./StudioCanvas";
import StudioToolbar from "./StudioToolbar";
import { useMoleculeStudio } from "./useMoleculeStudio";
import { useRepresentation } from "./useRepresentation";

interface Props {
  /** The drawing of the block being edited; null = a new drawing. */
  editing: MoleculeGraph | null;
  /** Put the drawing on the page (a new block): the answer key (everything drawn) or the student version (the masks applied). */
  onInsert: (graph: MoleculeGraph, view: StudioView) => void;
  /** Put the drawing back in the block it came from. */
  onUpdate: (graph: MoleculeGraph, view: StudioView) => void;
  /** Put the drawing on the page as one of the school representations (a new block). */
  onInsertMolecule: (molecule: MoleculeBlockData) => void;
  onClose: () => void;
}

const BLANK: MoleculeGraph = { atoms: [], bonds: [], annotations: [], hydrogens: "manual" };
// What a new drawing can start from: a blank page (the usual), or one of the test molecules.
const STARTS: { id: string; name?: { fr: string; en: string }; graph: MoleculeGraph }[] = [{ id: "blank", graph: BLANK }, ...SAMPLE_MOLECULES];

// The drawing Studio: a full-screen modal with the tools on the left, the drawing area in the middle
// and the properties on the right. The drawing lives in this Studio only (useMoleculeStudio, with its own
// undo and redo): the exam's own undo history gets one step when the drawing is inserted or updated.
export default function MoleculeStudio({ editing, onInsert, onUpdate, onInsertMolecule, onClose }: Props) {
  const { t, lang, rtl } = useUi();
  const studio = useMoleculeStudio(editing ?? BLANK);
  const { graph, activeElement, selection, clearSelection, selectEverything, deleteSelected, setElementOf, pickElement, loadGraph } = studio;
  const { undo, redo, canUndo, canRedo, dirty, copy, cut, paste } = studio;
  const { studioView, setStudioView } = studio;
  const student = studioView === "student";
  // The periodic table chooses the element in hand ("brush"), or the element of the selected atoms.
  const [tableFor, setTableFor] = useState<"brush" | "selection" | null>(null);
  const tableOpen = tableFor !== null;
  const [confirmClose, setConfirmClose] = useState(false);
  // How the drawing is shown: null = the drawing itself (editable), or one of the school representations, made from
  // the drawing (a read-only preview; Insert puts that representation on the page).
  const { representation: rep, setRepresentation: setRep } = studio;
  const preview = useRepresentation(graph, rep, studioView);
  const masked = maskedCount(graph);
  const locked = !!rep || student; // looking at it, not editing it: the tools and the properties are off
  const [startId, setStartId] = useState(STARTS[0].id);
  const start = STARTS.find((s) => s.id === startId) ?? STARTS[0];
  const { selectedShape } = studio;
  const empty = graph.atoms.length === 0 && graph.annotations.length === 0 && !graph.shapes?.length;
  const hasSelection = selection.atoms.length + selection.bonds.length + selection.notes.length > 0 || !!selectedShape;

  // Closing with changes in the drawing asks first (the drawing is lost otherwise).
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // Esc: closes the periodic table or the question (they handle that themselves), else clears the selection,
  // else closes the Studio. Delete / Backspace remove what is selected. Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z
  // redo; Ctrl+A selects everything; Ctrl+C, Ctrl+X and Ctrl+V copy, cut and paste (none of them while typing in
  // a field: it has its own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tableOpen || confirmClose || e.defaultPrevented) return; // the table, the question or the canvas took the key
      if (locked && e.key !== "Escape") return; // a representation or the student view is only looked at: the drawing underneath is not edited
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        // (the field of a text handles its own Esc and marks the key as handled: that never gets here)
        if (!typing && hasSelection) clearSelection();
        else requestClose();
      } else if ((e.ctrlKey || e.metaKey) && !typing && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && !typing && ["a", "c", "x", "v"].includes(key)) {
        e.preventDefault();
        if (key === "a") selectEverything();
        else if (key === "c") copy();
        else if (key === "x") cut();
        else paste();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && hasSelection) {
        e.preventDefault();
        deleteSelected();
      } else if (selectedShape && !typing && e.key.startsWith("Arrow")) {
        // a shape moves by a pixel (ten with Shift)
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        studio.nudgeShape(selectedShape.id, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      } else if (selectedShape && !typing && key === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        studio.turnShape(selectedShape.id, e.shiftKey ? -90 : 90);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableOpen, confirmClose, locked, hasSelection, selectedShape, clearSelection, selectEverything, deleteSelected, copy, cut, paste, undo, redo, dirty, onClose]);

  const chooseStart = (id: string) => {
    const next = STARTS.find((s) => s.id === id);
    if (!next) return;
    setStartId(next.id);
    loadGraph(next.graph);
  };

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";

  return (
    <div data-testid="molecule-studio-lab" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <h2 className="shrink-0 text-base font-semibold text-ink">{t("Molecule Studio")}</h2>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">{t("Drawing lab")}</span>

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
              onClick={() => setStudioView(v)}
              aria-pressed={studioView === v}
              data-view={v}
              title={v === "teacher" ? t("Teacher view: everything is drawn, the masked parts faded") : t("Student view: this is what the students will see")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${studioView === v ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {v === "teacher" ? t("Teacher view") : t("Student view")}
              {v === "student" && masked > 0 && <span className="ms-1.5 rounded-full bg-accent-soft px-1.5 text-[10px] tabular-nums text-accent-strong">{masked}</span>}
            </button>
          ))}
        </div>

        {/* where a new drawing starts from: only before anything is drawn (it would be lost) */}
        {!editing && (
          <label className="ms-auto flex items-center gap-2 text-xs text-muted">
            {t("Start from")}
            <select value={start.id} onChange={(e) => chooseStart(e.target.value)} disabled={dirty} data-testid="start-from" className="rounded-lg border border-line bg-subtle px-2 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-50">
              {STARTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ? (lang === "fr" ? s.name.fr : s.name.en) : t("Blank page")}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={() => (rep ? preview.status === "ready" && onInsertMolecule(preview.block) : editing ? onUpdate(graph, studioView) : onInsert(graph, studioView))}
          disabled={empty || (!!rep && preview.status !== "ready")}
          title={empty ? t("Nothing to insert yet: draw something first.") : undefined}
          data-testid="insert"
          className={`rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-40 ${editing ? "ms-auto" : ""}`}
        >
          {editing && !rep ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`flex w-[280px] shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l ${locked ? "pointer-events-none opacity-50" : ""}`}>
          <StudioToolbar studio={studio} onOpenTable={() => setTableFor("brush")} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div role="tablist" aria-label={t("Representation")} data-testid="representation-bar" className="m-3 mb-0 flex gap-1 rounded-xl bg-subtle p-1">
            {([null, ...availableRepresentations()] as (Representation | null)[]).map((r) => (
              <button
                key={r ?? "drawing"}
                role="tab"
                aria-selected={rep === r}
                title={r ? t(REP_LABEL[r]) : undefined}
                onClick={() => setRep(r)}
                className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${rep === r ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:bg-white/60 hover:text-ink"}`}
              >
                {r ? t(REP_SHORT[r]) : t("Drawing")}
              </button>
            ))}
          </div>
          {/* the canvas stays mounted under a preview, so that the view (zoom, position) is kept */}
          <div className={`min-h-0 flex-1 ${rep ? "hidden" : ""}`}>
            <StudioCanvas key={editing ? "editing" : start.id} studio={studio} student={student} />
          </div>
          {/* these two are text built from the whole molecule: nothing can be masked in them, and the student version would give the answer away */}
          {student && masked > 0 && (rep === "molecular" || rep === "semi-structural") && (
            <p role="alert" data-testid="mask-unsupported" className="mx-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t("Masks do not apply to this representation: the students would see all of it. Use the Developed, Skeletal, Lewis or Cram tab.")}
            </p>
          )}
          {rep && (
            <div dir="ltr" data-testid="representation-preview" className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-subtle/60 p-6">
              {empty ? (
                <p className="text-sm text-muted">{t("Draw a molecule to see its representations.")}</p>
              ) : preview.status === "ready" ? (
                <>
                  {/* a representation is made anyway when the engine cannot check the sketch: a small "!" says so */}
                  {preview.notes.length > 0 && (
                    <div className="absolute start-3 top-3 flex flex-col gap-1.5" data-testid="representation-notes">
                      {preview.notes.map((note) => (
                        <p key={note} role="status" className="flex max-w-xs items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
                          {note === "unchecked" ? t("Shown as drawn: the engine could not check this sketch (a bond count it does not accept, for example).") : t("Some masks could not be matched to this representation.")}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl bg-white p-4 shadow-sm [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: preview.svg }} />
                </>
              ) : preview.status === "error" ? (
                <p className="max-w-md text-center text-sm text-muted">
                  {t("This drawing cannot be turned into a representation:")} {preview.message}
                </p>
              ) : (
                <p className="text-sm text-muted">{t("Building the representation…")}</p>
              )}
            </div>
          )}
        </main>

        <aside className={`flex w-[300px] shrink-0 flex-col border-line bg-white ltr:border-l rtl:border-r ${locked ? "pointer-events-none opacity-50" : ""}`}>
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{t("Properties")}</h3>
          <PropertiesPanel studio={studio} onOpenTable={() => setTableFor("selection")} />
        </aside>
      </div>

      {tableOpen && (
        <PeriodicTableDialog
          selected={tableFor === "selection" ? (selection.atoms.length === 1 ? (graph.atoms.find((a) => a.id === selection.atoms[0])?.element ?? activeElement) : activeElement) : activeElement}
          onPick={(symbol) => {
            if (tableFor === "selection") setElementOf(selection.atoms, symbol); // the selected atoms take it
            else pickElement(symbol); // the element in hand (also switches to the atom tool)
            setTableFor(null);
          }}
          onClose={() => setTableFor(null)}
        />
      )}
      <StudioKeyboard />
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}

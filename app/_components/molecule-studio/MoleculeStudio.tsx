"use client";

import { ChevronsUpDown, Redo2, Undo2, X } from "lucide-react";
import { Notice, Segmented, control } from "@/app/_components/graph-studio/fields";
import { useEffect, useState } from "react";
import { SAMPLE_MOLECULES } from "@/app/_lib/chemistry/samples";
import { maskedCount, type StudioView } from "@/app/_lib/chemistry/masking";
import type { MoleculeGraph } from "@/app/_lib/chemistry/types";
import { useUi } from "@/app/_lib/uiLang";
import type { MoleculeBlockData, Representation } from "@/app/_molecule/model";
import { availableRepresentations } from "@/app/_molecule/render";
import { REP_LABEL } from "@/app/_molecule/strings";
import { StudioKeyboard } from "@/app/_components/math-keyboard/StudioKeyboard";
import TableToolDock from "@/app/_components/table-studio/TableToolDock";
import type { TableTool } from "@/app/_components/table-studio/TableDrawingLayer";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import DiscardDialog from "./DiscardDialog";
import PeriodicTableDialog from "./PeriodicTableDialog";
import PropertiesPanel from "./PropertiesPanel";
import StudioCanvas from "./StudioCanvas";
import StudioToolbar from "./StudioToolbar";
import { useMoleculeStudio } from "./useMoleculeStudio";
import { useRepresentation } from "./useRepresentation";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";

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

// The drawing Studio: a full-screen modal with the tools on the left, the drawing area in the middle (with the floating tool
// bar of the page: select, draw, text box, eraser, math keyboard) and the properties on the right. The drawing lives in this Studio only (useMoleculeStudio, with its own
// undo and redo): the exam's own undo history gets one step when the drawing is inserted or updated.
export default function MoleculeStudio({ editing, onInsert, onUpdate, onInsertMolecule, onClose }: Props) {
  const { t, lang } = useUi();
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
  const { selectedShape, activeTool } = studio;
  const ink = useInkTools(); // (the page's Draw tool: the same brush, pencil and highlighter, kept between sessions)
  const eraser = useEraserTool(); // (the page's Eraser: it rubs the drawings; the Eraser of the left panel deletes atoms and bonds)
  const barTool = (["draw", "shape", "textbox", "eraser"] as const).find((x) => x === activeTool);
  const dockTool: TableTool = barTool ?? "select";
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
        if (!typing && barTool) studio.setTool("select"); // (a tool of the floating bar, or a shape, is put down)
        else if (!typing && hasSelection) clearSelection();
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
  }, [tableOpen, confirmClose, locked, hasSelection, selectedShape, barTool, clearSelection, selectEverything, deleteSelected, copy, cut, paste, undo, redo, dirty, onClose]);

  const chooseStart = (id: string) => {
    const next = STARTS.find((s) => s.id === id);
    if (!next) return;
    setStartId(next.id);
    loadGraph(next.graph);
  };

  // (the header of the Chart Studio: small buttons, one line)
  const header = studioHeaderProps();
  const iconButton = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";
  const examples = editing
    ? undefined
    : { items: STARTS.map((s) => ({ id: s.id, name: s.name ? (lang === "fr" ? s.name.fr : s.name.en) : t("Blank page") })), current: start.id, disabled: dirty, onPick: chooseStart };

  return (
    <div data-testid="molecule-studio-lab" className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...header} className={`${header.className} gap-2! py-1.5!`}>
        <h2 className="shrink-0 text-sm font-semibold text-ink">{t("Molecule Studio")}</h2>
        <div className="mx-1 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={15} />
        </button>

        <div className="mx-1">
          <Segmented
            label={t("View")}
            testId="view-toggle"
            attr="data-view"
            value={studioView}
            onChange={setStudioView}
            options={[
              { value: "teacher", label: t("Teacher view"), title: t("Teacher view: everything is drawn, the masked parts faded") },
              {
                value: "student",
                title: t("Student view: this is what the students will see"),
                label: (
                  <>
                    {t("Student view")}
                    {masked > 0 && <span className="ms-1.5 rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-strong tabular-nums">{masked}</span>}
                  </>
                ),
              },
            ]}
          />
        </div>

        {/* how the drawing is shown, and inserted: the drawing itself, or one of the school representations made from it */}
        <label className="ms-auto flex items-center gap-2 text-xs text-muted">
          {t("Representation")}
          <span className="relative">
            <select value={rep ?? ""} onChange={(e) => setRep((e.target.value || null) as Representation | null)} data-testid="representation-bar" className={`${control} h-7 w-40 cursor-pointer appearance-none pe-7`}>
              {([null, ...availableRepresentations()] as (Representation | null)[]).map((r) => (
                <option key={r ?? "drawing"} value={r ?? ""}>
                  {r ? t(REP_LABEL[r]) : t("Drawing")}
                </option>
              ))}
            </select>
            <ChevronsUpDown size={13} strokeWidth={2} aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted" />
          </span>
        </label>
        <button
          onClick={() => (rep ? preview.status === "ready" && onInsertMolecule(preview.block) : editing ? onUpdate(graph, studioView) : onInsert(graph, studioView))}
          disabled={empty || (!!rep && preview.status !== "ready")}
          title={empty ? t("Nothing to insert yet: draw something first.") : undefined}
          data-testid="insert"
          className="h-7 shrink-0 rounded bg-accent px-3 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          {editing && !rep ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-7 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`flex w-[232px] shrink-0 flex-col border-line bg-white ltr:border-r rtl:border-l ${locked ? "pointer-events-none opacity-50" : ""}`}>
          <StudioToolbar studio={studio} onOpenTable={() => setTableFor("brush")} examples={examples} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {/* the canvas stays mounted under a preview, so that the view (zoom, position) is kept */}
          <div className={`relative min-h-0 flex-1 ${rep ? "hidden" : ""}`}>
            <StudioCanvas key={editing ? "editing" : start.id} studio={studio} student={student} ink={ink} eraser={eraser} />
            {/* the floating tool bar of the page: select, draw (brush, pencil, highlighter), text box, eraser, math keyboard */}
            {!student && <TableToolDock tool={dockTool} onTool={(next) => studio.setTool(next)} ink={ink} eraser={eraser} textboxHint={t("Text box: drag on the paper to draw one, then type")} />}
          </div>
          {/* these two are text built from the whole molecule: nothing can be masked in them, and the student version would give the answer away */}
          {student && masked > 0 && (rep === "molecular" || rep === "semi-structural") && (
            <div className="mx-3 mt-2"><Notice testId="mask-unsupported">
              {t("Masks do not apply to this representation: the students would see all of it. Use the Developed, Skeletal, Lewis or Cram tab.")}
            </Notice></div>
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
                          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[11px] font-bold text-white">!</span>
                          {note === "unchecked" ? t("Shown as drawn: the engine could not check this sketch (a bond count it does not accept, for example).") : t("Some masks could not be matched to this representation.")}
                        </p>
                      ))}
                    </div>
                  )}
                  <div data-paper="" className="rounded-xl bg-white p-4 shadow-sm [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: preview.svg }} />
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

        <aside className={`flex w-64 shrink-0 flex-col border-line bg-white ltr:border-l rtl:border-r ${locked ? "pointer-events-none opacity-50" : ""}`}>
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

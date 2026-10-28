"use client";

import { Minus, Plus, RefreshCcw, Table2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { formulaSegments, moleculesOf } from "@/app/_lib/chemistry/formula";
import { ARROW_MIN_WIDTH } from "@/app/_lib/chemistry/geometry";
import { COMMON_ELEMENTS, PERIODIC_TABLE, elementName, textColor } from "@/app/_lib/chemistry/periodicTable";
import { MAX_CHARGE, MAX_MASK, isEmpty } from "@/app/_lib/chemistry/selection";
import { DEFAULT_ATOM_MASK } from "@/app/_lib/chemistry/masking";
import { drawingIssues } from "@/app/_lib/chemistry/issues";
import { MAX_PAIRS, lonePairCounts } from "@/app/_lib/chemistry/lonePairs";
import { DIRECTED_BONDS } from "@/app/_lib/chemistry/bondGeometry";
import type { AtomNode, BondEdge, CanvasAnnotation } from "@/app/_lib/chemistry/types";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import { useUi } from "@/app/_lib/uiLang";
import { ALL_BOND_TYPES, useBondNames } from "./bondNames";
import { BondGlyph, ChemLabel } from "./glyphs";
import { issueMessage } from "./issueMessages";
import type { MoleculeStudioState } from "./useMoleculeStudio";

const MAX_LISTED = 6; // molecules listed in the summary; the rest is counted
const chip = (on: boolean) => `rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`;

interface Props {
  studio: MoleculeStudioState;
  /** Open the periodic table to choose the element of the selected atoms. */
  onOpenTable: () => void;
}

const signed = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`);

function Section({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5 rounded-xl border border-line bg-subtle/60 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{title}</h4>
      {children}
    </section>
  );
}

// The right panel of the Studio: what the drawing is (its molecules, with formula and molar mass), or, with
// something selected, what can be changed about it: the element and charge of atoms, the type of bonds, the text
// of a text or an arrow. Changes apply to everything selected, and are steps of the Studio's undo like the others.
export default function PropertiesPanel({ studio, onOpenTable }: Props) {
  const { t, lang } = useUi();
  const { graph, selection } = studio;

  const atoms = useMemo(() => selection.atoms.flatMap((id) => graph.atoms.find((a) => a.id === id) ?? []), [selection.atoms, graph.atoms]);
  const bonds = useMemo(() => selection.bonds.flatMap((id) => graph.bonds.find((b) => b.id === id) ?? []), [selection.bonds, graph.bonds]);
  const notes = useMemo(() => selection.notes.flatMap((id) => graph.annotations.find((n) => n.id === id) ?? []), [selection.notes, graph.annotations]);
  const issues = useMemo(() => drawingIssues(graph), [graph]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {isEmpty(selection) && !studio.selectedShape ? <Overview studio={studio} /> : null}
      {studio.selectedShape && (
        <div className="-mx-4 -mt-4 border-b border-line">
          <ShapeProperties
            key={studio.selectedShape.id}
            item={studio.selectedShape}
            geometry
            onChange={(patch) => studio.changeShape(studio.selectedShape!.id, patch, `shape:${studio.selectedShape!.id}:${Object.keys(patch).sort().join(",")}`)}
            onOrder={(order) => studio.orderShape(studio.selectedShape!.id, order)}
            onDuplicate={() => studio.duplicateShapeOf(studio.selectedShape!.id)}
            onDelete={studio.deleteSelected}
          />
        </div>
      )}
      {atoms.length > 0 && <AtomSection studio={studio} atoms={atoms} onOpenTable={onOpenTable} lang={lang} />}
      {bonds.length > 0 && <BondSection studio={studio} bonds={bonds} />}
      {notes.length === 1 && <NoteSection studio={studio} note={notes[0]} />}
      {notes.length > 1 && (
        <Section title={t("Texts and arrows: {count}", { count: notes.length })} testId="notes-section">
          <p className="text-sm text-muted">{t("Drag them together, or press Delete to remove them.")}</p>
        </Section>
      )}

      {issues.length > 0 && (
        <div role="status" data-testid="valence-warning" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="mb-1 font-medium">{t("Worth a look (nothing is blocked): {count}", { count: issues.length })}</p>
          <ul className="flex flex-col gap-0.5" data-testid="issue-list">
            {issues.slice(0, 5).map((issue, i) => (
              <li key={i}>
                <button onClick={() => studio.selectOnly("atoms", issue.atomId)} className="text-start underline-offset-2 hover:underline">
                  ! {issueMessage(issue, t)}
                </button>
              </li>
            ))}
            {issues.length > 5 && <li>{t("+ {count} more", { count: issues.length - 5 })}</li>}
          </ul>
        </div>
      )}

      <div className="mt-1 flex flex-col gap-1 text-sm tabular-nums text-ink" data-testid="graph-stats">
        <p>{t("Atoms: {count}", { count: graph.atoms.length })}</p>
        <p>{t("Bonds: {count}", { count: graph.bonds.length })}</p>
        <p>{t("Texts and arrows: {count}", { count: graph.annotations.length })}</p>
      </div>
    </div>
  );
}

// Nothing selected: the molecules of the drawing, with their formulas and molar masses.
function Overview({ studio }: { studio: MoleculeStudioState }) {
  const { t } = useUi();
  const molecules = useMemo(() => moleculesOf(studio.graph), [studio.graph]);
  if (!molecules.length) return <p className="text-sm text-faint">{t("Nothing drawn yet. Pick a tool on the left and click the paper.")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{molecules.length > 1 ? t("Molecules: {count}", { count: molecules.length }) : t("Molecule")}</h4>
      <ul className="flex flex-col gap-1.5" data-testid="molecules">
        {molecules.slice(0, MAX_LISTED).map((m, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 rounded-lg bg-subtle px-3 py-2">
            <span data-testid="formula" className="text-base font-semibold text-ink">
              <ChemLabel segments={formulaSegments(m.counts, m.charge)} />
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">{t("{mass} g/mol", { mass: m.mass.toFixed(2) })}</span>
          </li>
        ))}
        {molecules.length > MAX_LISTED && <li className="px-1 text-xs text-faint">{t("+ {count} more", { count: molecules.length - MAX_LISTED })}</li>}
      </ul>
      <p className="text-xs text-faint">{t("Click an atom or a bond to change it, or drag a frame around several.")}</p>
    </div>
  );
}

function AtomSection({ studio, atoms, onOpenTable, lang }: { studio: MoleculeStudioState; atoms: AtomNode[]; onOpenTable: () => void; lang: "en" | "fr" | "ar" }) {
  const { t } = useUi();
  const { setElementOf, setChargeOf, setMaskedOf, setMaskTextOf, startGesture, finishGesture, stepPairsOf, setPairsOf, setPairsHiddenOf } = studio;
  const ids = atoms.map((a) => a.id);
  const counts = useMemo(() => lonePairCounts(studio.graph), [studio.graph]);
  const own = atoms.map((a) => counts.get(a.id) ?? 0);
  const pairs = own.every((n) => n === own[0]) ? own[0] : null; // null: they have different numbers
  const automatic = atoms.every((a) => a.pairs === undefined && !a.pairDirs?.length);
  const placed = atoms.reduce((n, a) => n + (a.pairDirs?.length ?? 0), 0); // (put by hand)
  const pairsHidden = atoms.filter((a) => a.pairsHidden).length;
  const masked = atoms.filter((a) => a.hidden).length;
  // The replacement text the masked atoms share (null: they have different ones).
  const texts = atoms.filter((a) => a.hidden).map((a) => a.mask ?? DEFAULT_ATOM_MASK);
  const replacement = texts.every((x) => x === texts[0]) ? (texts[0] ?? "") : null;
  const element = atoms.every((a) => a.element === atoms[0].element) ? atoms[0].element : null; // null: several elements
  const charge = atoms.every((a) => a.charge === atoms[0].charge) ? atoms[0].charge : null;
  const data = element ? PERIODIC_TABLE[element] : undefined;
  const title = atoms.length === 1 && data ? `${data.symbol} — ${elementName(data, lang)}` : t("Atoms: {count}", { count: atoms.length });
  const shown = element && !COMMON_ELEMENTS.includes(element) ? [element, ...COMMON_ELEMENTS] : COMMON_ELEMENTS; // an unusual element is shown too

  return (
    <Section title={title} testId="atom-section">
      <div>
        <p className="mb-1.5 text-xs text-muted">{t("Element")}</p>
        <div className="flex flex-wrap gap-1.5" dir="ltr">
          {shown.map((symbol) => (
            <button key={symbol} onClick={() => setElementOf(ids, symbol)} aria-pressed={element === symbol} data-element={symbol} title={elementName(PERIODIC_TABLE[symbol], lang)} className={chip(element === symbol)}>
              <span className="font-bold" style={{ color: textColor(PERIODIC_TABLE[symbol].color) }}>
                {symbol}
              </span>
            </button>
          ))}
          <button onClick={onOpenTable} title={t("All elements")} data-testid="other-element" className={`${chip(false)} inline-flex items-center gap-1`}>
            <Table2 size={13} />
            {t("Other")}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{t("Charge")}</p>
        <div className="flex items-center gap-1" dir="ltr">
          <button
            onClick={() => setChargeOf(ids, (charge ?? atoms[0].charge) - 1)}
            disabled={(charge ?? atoms[0].charge) <= -MAX_CHARGE}
            aria-label={t("Charge −1")}
            data-testid="charge-minus"
            className="grid size-7 place-items-center rounded-lg border border-line bg-white text-ink hover:border-accent hover:bg-accent-soft disabled:opacity-40"
          >
            <Minus size={14} />
          </button>
          <span data-testid="charge-value" className="min-w-9 text-center text-sm font-semibold tabular-nums text-ink">
            {charge === null ? "—" : signed(charge)}
          </span>
          <button
            onClick={() => setChargeOf(ids, (charge ?? atoms[0].charge) + 1)}
            disabled={(charge ?? atoms[0].charge) >= MAX_CHARGE}
            aria-label={t("Charge +1")}
            data-testid="charge-plus"
            className="grid size-7 place-items-center rounded-lg border border-line bg-white text-ink hover:border-accent hover:bg-accent-soft disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-2.5" data-testid="pairs-atoms">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">{t("Lone pairs")}</p>
          <div className="flex items-center gap-1" dir="ltr">
            <button onClick={() => stepPairsOf(ids, -1)} disabled={(pairs ?? 0) <= 0} aria-label={t("One lone pair less")} data-testid="pairs-minus" className="grid size-7 place-items-center rounded-lg border border-line bg-white text-ink hover:border-accent hover:bg-accent-soft disabled:opacity-40">
              <Minus size={14} />
            </button>
            <span data-testid="pairs-value" className="min-w-9 text-center text-sm font-semibold tabular-nums text-ink">
              {pairs ?? "—"}
            </span>
            <button onClick={() => stepPairsOf(ids, 1)} disabled={(pairs ?? 0) >= MAX_PAIRS} aria-label={t("One lone pair more")} data-testid="pairs-plus" className="grid size-7 place-items-center rounded-lg border border-line bg-white text-ink hover:border-accent hover:bg-accent-soft disabled:opacity-40">
              <Plus size={14} />
            </button>
          </div>
        </div>
        {placed > 0 && (
          <p className="text-xs text-muted" data-testid="pairs-placed">
            {t("Placed by hand: {count}", { count: placed })}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setPairsOf(ids, undefined)} aria-pressed={automatic} data-testid="pairs-auto" title={t("The number its valence leaves")} className={chip(automatic)}>
            {t("Automatic")}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={pairsHidden === atoms.length} ref={(el) => { if (el) el.indeterminate = pairsHidden > 0 && pairsHidden < atoms.length; }} onChange={() => setPairsHiddenOf(ids, pairsHidden !== atoms.length)} data-testid="pairs-hide" className="size-4 accent-indigo-600" />
            {t("Hide them from the students")}
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-2.5" data-testid="mask-atoms">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={masked === atoms.length} ref={(el) => { if (el) el.indeterminate = masked > 0 && masked < atoms.length; }} onChange={() => setMaskedOf({ atoms: ids, bonds: [] }, masked !== atoms.length)} data-testid="mask-atom" className="size-4 accent-indigo-600" />
          {t("Mask the atom")}
        </label>
        {masked > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("Replacement text")}
            <input
              value={replacement ?? ""}
              placeholder={replacement === null ? "—" : t("Empty: a dashed box")}
              dir="auto"
              maxLength={MAX_MASK}
              data-testid="mask-text"
              onFocus={startGesture} // everything typed here is one step
              onBlur={finishGesture}
              onChange={(e) => setMaskTextOf({ atoms: ids, bonds: [] }, e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && (e.preventDefault(), e.currentTarget.blur())}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
              style={{ userSelect: "text" }}
            />
            <span className="text-[11px] text-faint">{t("What the students see instead of the symbol")}</span>
          </label>
        )}
      </div>
    </Section>
  );
}

function BondSection({ studio, bonds }: { studio: MoleculeStudioState; bonds: BondEdge[] }) {
  const { t } = useUi();
  const { setTypeOfBonds, reverseBondsOf, setMaskedOf, setMaskTextOf } = studio;
  const ids = bonds.map((b) => b.id);
  const masked = bonds.filter((b) => b.hidden).length;
  const kinds = new Set(bonds.filter((b) => b.hidden).map((b) => (b.mask === "" ? "nothing" : "dashed")));
  const missing = kinds.size === 1 ? [...kinds][0] : null;
  const type = bonds.every((b) => b.type === bonds[0].type) ? bonds[0].type : null;
  const names = useBondNames().full;
  const directed = bonds.some((b) => DIRECTED_BONDS.includes(b.type));

  return (
    <Section title={t("Bonds: {count}", { count: bonds.length })} testId="bond-section">
      <div className="grid grid-cols-5 gap-1.5" dir="ltr" title={type ? names[type] : undefined}>
        {ALL_BOND_TYPES.map((candidate) => (
          <button key={candidate} onClick={() => setTypeOfBonds(ids, candidate)} aria-pressed={type === candidate} title={names[candidate]} aria-label={names[candidate]} data-bond-set={candidate} className={`${chip(type === candidate)} grid place-items-center px-0`}>
            <BondGlyph type={candidate} />
          </button>
        ))}
      </div>
      {directed && (
        <button onClick={() => reverseBondsOf(ids)} data-testid="reverse-bonds" className={`${chip(false)} inline-flex items-center justify-center gap-1.5`}>
          <RefreshCcw size={13} />
          {t("Reverse direction")}
        </button>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-2.5" data-testid="mask-bonds">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={masked === bonds.length} ref={(el) => { if (el) el.indeterminate = masked > 0 && masked < bonds.length; }} onChange={() => setMaskedOf({ atoms: [], bonds: ids }, masked !== bonds.length)} data-testid="mask-bond" className="size-4 accent-indigo-600" />
          {t("Mask the bond")}
        </label>
        {masked > 0 && (
          <div className="flex flex-col gap-1 text-xs text-muted">
            {t("What the students see instead of the bond")}
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setMaskTextOf({ atoms: [], bonds: ids }, undefined)} aria-pressed={missing === "dashed"} data-testid="mask-bond-dashed" className={chip(missing === "dashed")}>
                {t("A dashed line")}
              </button>
              <button onClick={() => setMaskTextOf({ atoms: [], bonds: ids }, "")} aria-pressed={missing === "nothing"} data-testid="mask-bond-nothing" className={chip(missing === "nothing")}>
                {t("Nothing")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function NoteSection({ studio, note }: { studio: MoleculeStudioState; note: CanvasAnnotation }) {
  const { t } = useUi();
  const { updateAnnotation, deleteAnnotation, startGesture, finishGesture } = studio;
  const arrow = note.type === "arrow";
  return (
    <Section title={arrow ? t("Arrow") : t("Text")} testId="note-section">
      <label className="flex flex-col gap-1 text-xs text-muted">
        {arrow ? t("Conditions (H+, Δ…)") : t("Text")}
        <input
          value={note.text ?? ""}
          dir="auto"
          data-testid="note-text"
          onFocus={startGesture} // everything typed here is one step
          onBlur={() => {
            if (!arrow && !(note.text ?? "").trim()) deleteAnnotation(note.id); // an empty text is not kept
            finishGesture();
          }}
          onChange={(e) => updateAnnotation(note.id, { text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault(); // (Esc must not close the Studio)
              e.currentTarget.blur();
            }
          }}
          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          style={{ userSelect: "text" }}
        />
      </label>
      {arrow && (
        <label className="flex items-center justify-between gap-2 text-xs text-muted">
          {t("Length")}
          <input
            type="number"
            min={ARROW_MIN_WIDTH}
            step={10}
            value={Math.round(note.width ?? 0)}
            data-testid="arrow-length"
            onFocus={startGesture}
            onBlur={finishGesture}
            onChange={(e) => updateAnnotation(note.id, { width: Number(e.target.value) || ARROW_MIN_WIDTH })}
            onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && (e.preventDefault(), e.currentTarget.blur())}
            className="w-24 rounded-lg border border-line bg-white px-2.5 py-1.5 text-end text-sm tabular-nums text-ink outline-none focus:border-accent"
            style={{ userSelect: "text" }}
          />
        </label>
      )}
    </Section>
  );
}

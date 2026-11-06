"use client";

import { Minus, Plus, RefreshCcw, Table2 } from "lucide-react";
import { useId, useMemo, type KeyboardEvent, type ReactNode } from "react";
import { formulaSegments, moleculesOf } from "@/app/_lib/chemistry/formula";
import { ARROW_MIN_WIDTH } from "@/app/_lib/chemistry/geometry";
import { COMMON_ELEMENTS, PERIODIC_TABLE, elementName, textColor } from "@/app/_lib/chemistry/periodicTable";
import { MAX_CHARGE, MAX_MASK, isEmpty } from "@/app/_lib/chemistry/selection";
import { DEFAULT_ATOM_MASK } from "@/app/_lib/chemistry/masking";
import { drawingIssues } from "@/app/_lib/chemistry/issues";
import { MAX_PAIRS, lonePairCounts } from "@/app/_lib/chemistry/lonePairs";
import { DIRECTED_BONDS } from "@/app/_lib/chemistry/bondGeometry";
import type { AtomNode, BondEdge, CanvasAnnotation } from "@/app/_lib/chemistry/types";
import Disclosure from "@/app/_components/graph-studio/Disclosure";
import { Group, Notice, Row, SelectField, SwitchRow, control, held, idle, softButton, tileBase } from "@/app/_components/graph-studio/fields";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import { useUi } from "@/app/_lib/uiLang";
import { ALL_BOND_TYPES, useBondNames } from "./bondNames";
import { BondGlyph, ChemLabel } from "./glyphs";
import { issueMessage } from "./issueMessages";
import type { MoleculeStudioState } from "./useMoleculeStudio";

const MAX_LISTED = 6; // molecules listed in the summary; the rest is counted
const MAX_ISSUES = 5;

interface Props {
  studio: MoleculeStudioState;
  /** Open the periodic table to choose the element of the selected atoms. */
  onOpenTable: () => void;
}

const signed = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`);
// (a field typed in: Enter and Esc leave it, and Esc must not close the Studio)
const leaveOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    e.currentTarget.blur();
  }
};

// The right panel of the Studio: what the drawing is (its molecules, with formula and molar mass), or, with something selected, what can
// be changed about it: the element, charge, lone pairs and mask of atoms, the type and mask of bonds, the text of a text or an arrow.
// Changes apply to everything selected, and are steps of the Studio's undo like the others. What is worth a look stays at the bottom.
export default function PropertiesPanel({ studio, onOpenTable }: Props) {
  const { t, lang } = useUi();
  const { graph, selection } = studio;

  const atoms = useMemo(() => selection.atoms.flatMap((id) => graph.atoms.find((a) => a.id === id) ?? []), [selection.atoms, graph.atoms]);
  const bonds = useMemo(() => selection.bonds.flatMap((id) => graph.bonds.find((b) => b.id === id) ?? []), [selection.bonds, graph.bonds]);
  const notes = useMemo(() => selection.notes.flatMap((id) => graph.annotations.find((n) => n.id === id) ?? []), [selection.notes, graph.annotations]);
  const issues = useMemo(() => drawingIssues(graph), [graph]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="molecule-properties">
      {isEmpty(selection) && !studio.selectedShape ? <Overview studio={studio} /> : null}
      {studio.selectedShape && (
        <div className="border-b border-line/70">
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
        <Disclosure title={t("Texts and arrows: {count}", { count: notes.length })} testId="notes-section">
          <p className="px-1 text-[13px] text-muted">{t("Drag them together, or press Delete to remove them.")}</p>
        </Disclosure>
      )}

      {issues.length > 0 && (
        <div className="p-4">
          <Notice testId="valence-warning">
            <p className="mb-1 font-medium">{t("Worth a look (nothing is blocked): {count}", { count: issues.length })}</p>
            <ul className="flex flex-col gap-0.5" data-testid="issue-list">
              {issues.slice(0, MAX_ISSUES).map((issue, i) => (
                <li key={i}>
                  <button onClick={() => studio.selectOnly("atoms", issue.atomId)} className="text-start underline-offset-2 hover:underline">
                    {issueMessage(issue, t)}
                  </button>
                </li>
              ))}
              {issues.length > MAX_ISSUES && <li>{t("+ {count} more", { count: issues.length - MAX_ISSUES })}</li>}
            </ul>
          </Notice>
        </div>
      )}
    </div>
  );
}

// Nothing selected: the molecules of the drawing, with their formulas and molar masses, and what the drawing holds.
function Overview({ studio }: { studio: MoleculeStudioState }) {
  const { t } = useUi();
  const { graph } = studio;
  const molecules = useMemo(() => moleculesOf(graph), [graph]);
  if (!molecules.length) return <p className="px-4 py-3 text-[13px] text-muted">{t("Nothing drawn yet. Pick a tool on the left and click the paper.")}</p>;
  const counts = [t("Atoms: {count}", { count: graph.atoms.length }), t("Bonds: {count}", { count: graph.bonds.length })];
  if (graph.annotations.length) counts.push(t("Texts and arrows: {count}", { count: graph.annotations.length }));
  return (
    <Disclosure title={molecules.length > 1 ? t("Molecules: {count}", { count: molecules.length }) : t("Molecule")} testId="molecules-section">
      <Group>
        <ul className="contents" data-testid="molecules">
          {molecules.slice(0, MAX_LISTED).map((m, i) => (
            <li key={i} className="flex min-h-10 items-baseline justify-between gap-3 px-3.5 py-2">
              <span data-testid="formula" className="text-[15px] font-semibold text-ink">
                <ChemLabel segments={formulaSegments(m.counts, m.charge)} />
              </span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{t("{mass} g/mol", { mass: m.mass.toFixed(2) })}</span>
            </li>
          ))}
          {molecules.length > MAX_LISTED && <li className="px-3.5 py-2 text-xs text-muted">{t("+ {count} more", { count: molecules.length - MAX_LISTED })}</li>}
        </ul>
      </Group>
      <p className="px-1 text-xs text-muted tabular-nums" data-testid="graph-stats">
        {counts.join(" · ")}
      </p>
    </Disclosure>
  );
}

// −, the value, + (a charge, a number of lone pairs)
function Stepper({ value, onStep, canDown, canUp, downLabel, upLabel, testId }: { value: string; onStep: (by: number) => void; canDown: boolean; canUp: boolean; downLabel: string; upLabel: string; testId: string }) {
  const step = "grid size-7 place-items-center rounded-full bg-white text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.07)] transition-[transform,opacity] duration-100 ease-out outline-none enabled:hover:text-accent-strong enabled:active:scale-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" dir="ltr">
      <button onClick={() => onStep(-1)} disabled={!canDown} aria-label={downLabel} data-testid={`${testId}-minus`} className={step}>
        <Minus size={13} />
      </button>
      <span data-testid={`${testId}-value`} className="min-w-8 text-center text-[13px] font-semibold text-ink tabular-nums">
        {value}
      </span>
      <button onClick={() => onStep(1)} disabled={!canUp} aria-label={upLabel} data-testid={`${testId}-plus`} className={step}>
        <Plus size={13} />
      </button>
    </div>
  );
}

// A text typed in a stacked row: everything typed while it has the focus is one step of the undo.
function TypedText({ label, value, onChange, onFocus, onBlur, testId, placeholder, maxLength, hint }: { label: string; value: string; onChange: (v: string) => void; onFocus: () => void; onBlur: () => void; testId: string; placeholder?: string; maxLength?: number; hint?: ReactNode }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id} stacked>
      <input id={id} value={value} placeholder={placeholder} dir="auto" maxLength={maxLength} data-testid={testId} onFocus={onFocus} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} onKeyDown={leaveOnEnter} className={`${control} h-9 w-full`} style={{ userSelect: "text" }} />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Row>
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
  const current = charge ?? atoms[0].charge;
  const data = element ? PERIODIC_TABLE[element] : undefined;
  const title = atoms.length === 1 && data ? `${data.symbol} — ${elementName(data, lang)}` : t("Atoms: {count}", { count: atoms.length });
  const shown = element && !COMMON_ELEMENTS.includes(element) ? [element, ...COMMON_ELEMENTS] : COMMON_ELEMENTS; // an unusual element is shown too

  return (
    <Disclosure title={title} testId="atom-section">
      <div className="grid grid-cols-5 gap-1.5" dir="ltr" role="group" aria-label={t("Element")}>
        {shown.map((symbol) => (
          <button
            key={symbol}
            onClick={() => setElementOf(ids, symbol)}
            aria-pressed={element === symbol}
            data-element={symbol}
            title={elementName(PERIODIC_TABLE[symbol], lang)}
            className={`${tileBase} h-8 text-[13px]! font-bold! ${element === symbol ? held : idle}`}
            style={{ color: element === symbol ? undefined : textColor(PERIODIC_TABLE[symbol].color) }}
          >
            {symbol}
          </button>
        ))}
        <button onClick={onOpenTable} title={t("All elements")} aria-label={t("All elements")} data-testid="other-element" className={`${tileBase} h-8 ${idle}`}>
          <Table2 size={14} />
        </button>
      </div>

      <Group>
        <Row label={t("Charge")}>
          <Stepper value={charge === null ? "—" : signed(charge)} onStep={(by) => setChargeOf(ids, current + by)} canDown={current > -MAX_CHARGE} canUp={current < MAX_CHARGE} downLabel={t("Charge −1")} upLabel={t("Charge +1")} testId="charge" />
        </Row>
      </Group>

      <Group>
        <Row label={t("Lone pairs")}>
          <Stepper value={pairs === null ? "—" : String(pairs)} onStep={(by) => stepPairsOf(ids, by)} canDown={(pairs ?? 0) > 0} canUp={(pairs ?? 0) < MAX_PAIRS} downLabel={t("One lone pair less")} upLabel={t("One lone pair more")} testId="pairs" />
        </Row>
        {/* off: the number shown now is kept as it is */}
        <SwitchRow label={t("Automatic")} title={t("The number its valence leaves")} checked={automatic} onChange={(on) => setPairsOf(ids, on ? undefined : (pairs ?? own[0]))} testId="pairs-auto" />
        <SwitchRow label={t("Hide them from the students")} checked={pairsHidden === atoms.length} onChange={(on) => setPairsHiddenOf(ids, on)} testId="pairs-hide" />
      </Group>
      {placed > 0 && (
        <p className="-mt-1 px-1 text-xs text-muted" data-testid="pairs-placed">
          {t("Placed by hand: {count}", { count: placed })}
        </p>
      )}

      <Group>
        <SwitchRow label={t("Mask the atom")} checked={masked === atoms.length} onChange={(on) => setMaskedOf({ atoms: ids, bonds: [] }, on)} testId="mask-atom" />
        {masked > 0 && (
          <TypedText
            label={t("Replacement text")}
            value={replacement ?? ""}
            placeholder={replacement === null ? "—" : t("Empty: a dashed box")}
            maxLength={MAX_MASK}
            testId="mask-text"
            onFocus={startGesture}
            onBlur={finishGesture}
            onChange={(v) => setMaskTextOf({ atoms: ids, bonds: [] }, v)}
            hint={t("What the students see instead of the symbol")}
          />
        )}
      </Group>
    </Disclosure>
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
    <Disclosure title={bonds.length === 1 && type ? names[type] : t("Bonds: {count}", { count: bonds.length })} testId="bond-section">
      <div className="grid grid-cols-5 gap-1.5" dir="ltr" role="group" aria-label={t("Bonds")}>
        {ALL_BOND_TYPES.map((candidate) => (
          <button key={candidate} onClick={() => setTypeOfBonds(ids, candidate)} aria-pressed={type === candidate} title={names[candidate]} aria-label={names[candidate]} data-bond-set={candidate} className={`${tileBase} h-8 ${type === candidate ? held : idle}`}>
            <BondGlyph type={candidate} />
          </button>
        ))}
      </div>
      {directed && (
        <button onClick={() => reverseBondsOf(ids)} data-testid="reverse-bonds" className={softButton}>
          <RefreshCcw size={14} />
          {t("Reverse direction")}
        </button>
      )}

      <Group>
        <SwitchRow label={t("Mask the bond")} checked={masked === bonds.length} onChange={(on) => setMaskedOf({ atoms: [], bonds: ids }, on)} testId="mask-bond" />
        {masked > 0 && (
          <SelectField
            stacked
            label={t("What the students see instead of the bond")}
            value={missing ?? "dashed"}
            onChange={(v) => setMaskTextOf({ atoms: [], bonds: ids }, v === "nothing" ? "" : undefined)}
            options={[
              { value: "dashed", label: t("A dashed line") },
              { value: "nothing", label: t("Nothing") },
            ]}
            testId="mask-bond-kind"
          />
        )}
      </Group>
    </Disclosure>
  );
}

function NoteSection({ studio, note }: { studio: MoleculeStudioState; note: CanvasAnnotation }) {
  const { t } = useUi();
  const { updateAnnotation, deleteAnnotation, startGesture, finishGesture } = studio;
  const arrow = note.type === "arrow";
  const lengthId = useId();
  return (
    <Disclosure title={arrow ? t("Arrow") : t("Text")} testId="note-section">
      <Group>
        <TypedText
          label={arrow ? t("Conditions (H+, Δ…)") : t("Text")}
          value={note.text ?? ""}
          testId="note-text"
          onFocus={startGesture}
          onBlur={() => {
            if (!arrow && !(note.text ?? "").trim()) deleteAnnotation(note.id); // an empty text is not kept
            finishGesture();
          }}
          onChange={(text) => updateAnnotation(note.id, { text })}
        />
        {arrow && (
          <Row label={t("Length")} htmlFor={lengthId}>
            <input
              id={lengthId}
              type="number"
              min={ARROW_MIN_WIDTH}
              step={10}
              value={Math.round(note.width ?? 0)}
              data-testid="arrow-length"
              onFocus={startGesture}
              onBlur={finishGesture}
              onChange={(e) => updateAnnotation(note.id, { width: Number(e.target.value) || ARROW_MIN_WIDTH })}
              onKeyDown={leaveOnEnter}
              dir="ltr"
              className={`${control} h-8 w-24 text-end tabular-nums`}
              style={{ userSelect: "text" }}
            />
          </Row>
        )}
      </Group>
    </Disclosure>
  );
}

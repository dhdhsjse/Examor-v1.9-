"use client";

import { ArrowRight, CircleDot, Dot, Eraser, MousePointer2, Table2, Type } from "lucide-react";
import type { HydrogenMode, LonePairMode } from "@/app/_lib/chemistry/types";
import type { ReactNode } from "react";
import { COMMON_ELEMENTS, PERIODIC_TABLE, elementName, textColor } from "@/app/_lib/chemistry/periodicTable";
import { FRAGMENTS, FRAGMENT_IDS, type FragmentId } from "@/app/_lib/chemistry/fragments";
import { TOOL_HINTS } from "@/app/_lib/chemistry/strings";
import type { RingSpec } from "@/app/_lib/chemistry/types";
import { useUi } from "@/app/_lib/uiLang";
import { BOND_GROUPS, useBondGroupNames, useBondNames } from "./bondNames";
import { BondGlyph, ChemLabel } from "./glyphs";
import type { MoleculeStudioState, StudioTool } from "./useMoleculeStudio";

interface Props {
  studio: MoleculeStudioState;
  onOpenTable: () => void;
}

// The left panel of the Studio: the tools, the elements a teacher uses most, and the whole table.
export default function StudioToolbar({ studio, onOpenTable }: Props) {
  const { t, lang } = useUi();
  const { activeTool, setActiveTool, activeElement, pickElement, activeBondType, pickBond, activeRing, pickRing, activeTemplate, pickTemplate } = studio;
  const current = PERIODIC_TABLE[activeElement];
  const modes: { id: HydrogenMode; name: string; hint: string }[] = [
    { id: "manual", name: t("Manual"), hint: t("Manual: nothing is added, you draw every bond yourself") },
    { id: "auto", name: t("Auto"), hint: t("Auto: the missing hydrogens are added for you") },
    { id: "labels", name: t("Labels"), hint: t("Labels: the missing hydrogens are written next to the atom (CH3, OH)") },
  ];
  const mode = modes.find((m) => m.id === studio.hydrogenMode) ?? modes[0];
  const bondNames = useBondNames();
  const groupNames = useBondGroupNames();
  const pairModes: { id: LonePairMode; name: string; hint: string }[] = [
    { id: "off", name: t("Off"), hint: t("Off: the lone pairs are not written") },
    { id: "dots", name: t("Dots"), hint: t("Dots: each lone pair is two dots") },
    { id: "lines", name: t("Bars"), hint: t("Bars: each lone pair is a short bar") },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <section className="flex flex-col gap-2" aria-label={t("Hydrogens")} data-testid="hydrogen-modes">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Hydrogens")}</h3>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((m) => {
            const on = m.id === studio.hydrogenMode;
            return (
              <button
                key={m.id}
                onClick={() => studio.setHydrogenMode(m.id)}
                aria-pressed={on}
                title={m.hint}
                data-hydrogen-mode={m.id}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted" data-testid="hydrogen-hint">
          {mode.hint}
        </p>
        {studio.hydrogenMode !== "auto" && (
          <button onClick={studio.addMissingHydrogens} disabled={studio.graph.atoms.length === 0} data-testid="add-hydrogens" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-40">
            {t("Add the missing hydrogens")}
          </button>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Tools")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Tools")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton tool="select" active={activeTool} onPick={setActiveTool} icon={<MousePointer2 size={16} />} label={t("Select")} hint={t("Select and move atoms")} />
          <ToolButton tool="erase" active={activeTool} onPick={setActiveTool} icon={<Eraser size={16} />} label={t("Eraser")} hint={t("Click an atom to delete it and its bonds")} />
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Bonds")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Bonds")}</h3>
        {BOND_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-1.5" data-bond-group={group.id}>
            <p className="text-[11px] font-medium text-muted">{groupNames[group.id]}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {group.types.map((type) => {
                const on = activeTool === "bond" && activeBondType === type; // the bond type is only "in hand" with the bond tool
                return (
                  <button
                    key={type}
                    onClick={() => pickBond(type)}
                    aria-pressed={on}
                    title={`${bondNames.full[type]} — ${t("Drag from an atom to draw a bond")}`}
                    data-bond-type={type}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
                  >
                    <BondGlyph type={type} />
                    {bondNames.short[type]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Lone pairs")} data-testid="lone-pair-modes">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Lone pairs")}</h3>
        <div className="grid grid-cols-3 gap-2">
          {pairModes.map((m) => {
            const on = m.id === studio.lonePairMode;
            return (
              <button
                key={m.id}
                onClick={() => {
                  studio.setLonePairMode(m.id);
                  // Dots or Bars: the next clicks put pairs; None: back to Select
                  if (m.id !== "off") setActiveTool("pair");
                  else if (activeTool === "pair") setActiveTool("select");
                }}
                aria-pressed={on}
                title={m.hint}
                data-pair-mode={m.id}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted" data-testid="pair-hint">
          {pairModes.find((m) => m.id === studio.lonePairMode)?.hint}
        </p>
        <ToolButton
          tool="pair"
          active={activeTool}
          onPick={(tool) => {
            setActiveTool(tool);
            if (studio.lonePairMode === "off") studio.setLonePairMode("dots"); // (the pairs are written, or the tool would seem to do nothing)
          }}
          icon={<CircleDot size={16} />}
          label={t("Lone pair")}
          hint={t(TOOL_HINTS.pair)}
        />
        <p className="text-xs text-muted" data-testid="pair-tool-hint">
          {activeTool === "pair" ? t(TOOL_HINTS.pair) : t("In Select mode, drag a pair to move it round its atom")}
        </p>
        <ToolButton tool="electron" active={activeTool} onPick={setActiveTool} icon={<Dot size={16} />} label={t("Single electron")} hint={t(TOOL_HINTS.electron)} />
        {activeTool === "electron" && (
          <p className="text-xs text-muted" data-testid="electron-tool-hint">
            {t(TOOL_HINTS.electron)}
          </p>
        )}
        <button onClick={studio.writeAllPairs} disabled={studio.graph.atoms.length === 0} title={t("Every atom gets the pairs its valence leaves, placed automatically")} data-testid="pairs-write-all" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-40">
          {t("Write them all automatically")}
        </button>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Atoms")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Atoms")}</h3>
        <div className="grid grid-cols-4 gap-2" dir="ltr" role="group" aria-label={t("Common elements")}>
          {COMMON_ELEMENTS.map((symbol) => {
            const e = PERIODIC_TABLE[symbol];
            const on = activeTool === "atom" && symbol === activeElement; // the brush is only "in hand" with the atom tool
            return (
              <button
                key={symbol}
                onClick={() => pickElement(symbol)}
                aria-pressed={on}
                title={elementName(e, lang)}
                aria-label={`${symbol} — ${elementName(e, lang)}`}
                data-symbol={symbol}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border leading-none transition-colors ${on ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-white hover:border-accent hover:bg-accent-soft"}`}
              >
                <span className="text-xl font-bold" style={{ color: textColor(e.color) }}>
                  {symbol}
                </span>
                <span className="mt-1 text-[10px] tabular-nums text-faint">{e.atomicNumber}</span>
              </button>
            );
          })}
        </div>
        <button onClick={onOpenTable} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft">
          <Table2 size={16} />
          {t("All elements")}
        </button>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Rings")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Rings")}</h3>
        <div className="grid grid-cols-3 gap-2">
          {RING_BUTTONS.map(({ id, ring }) => {
            const on = activeTool === "ring" && activeRing.sides === ring.sides && activeRing.isAromatic === ring.isAromatic;
            const name = id === "benzene" ? t("Benzene") : id === "cyclohexane" ? t("Cyclohexane") : t("Cyclopentane");
            return (
              <button
                key={id}
                onClick={() => pickRing(ring)}
                aria-pressed={on}
                title={`${name} — ${t("Click the paper to place the ring")}`}
                data-ring={id}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium leading-tight transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
              >
                <RingGlyph ring={ring} />
                {name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Functional groups")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Functional groups")}</h3>
        <div className="grid grid-cols-3 gap-2" dir="ltr">
          {FRAGMENT_IDS.map((id) => {
            const on = activeTool === "template" && activeTemplate === id;
            return (
              <button
                key={id}
                onClick={() => pickTemplate(id)}
                aria-pressed={on}
                title={`${GROUP_NAME[id](t)} — ${t(TOOL_HINTS.template)}`}
                aria-label={`${FRAGMENTS[id].label} — ${GROUP_NAME[id](t)}`}
                data-template={id}
                className={`grid h-10 place-items-center rounded-xl border text-sm font-bold transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
              >
                <span>
                  <span className="font-normal text-faint">–</span>
                  <ChemLabel text={FRAGMENTS[id].label} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Annotations")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Annotations")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton tool="text" active={activeTool} onPick={setActiveTool} icon={<Type size={16} />} label={t("Text")} hint={t(TOOL_HINTS.text)} />
          <ToolButton tool="arrow" active={activeTool} onPick={setActiveTool} icon={<ArrowRight size={16} />} label={t("Arrow")} hint={t(TOOL_HINTS.arrow)} />
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Element to draw with")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Element to draw with")}</h3>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-subtle p-3" data-testid="active-element">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg border border-line bg-white text-3xl font-bold" style={{ color: textColor(current.color) }}>
            {current.symbol}
          </span>
          <div className="min-w-0 text-xs text-muted">
            <p className="truncate text-sm font-semibold text-ink">{elementName(current, lang)}</p>
            <p className="tabular-nums">
              {t("Atomic number")}: {current.atomicNumber}
            </p>
            <p className="tabular-nums">
              {t("Atomic mass")}: {current.atomicMass}
            </p>
            <p className="tabular-nums">
              {t("Valence")}: {current.valence || "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

const RING_BUTTONS: { id: "cyclohexane" | "benzene" | "cyclopentane"; ring: RingSpec }[] = [
  { id: "cyclohexane", ring: { sides: 6, isAromatic: false } },
  { id: "benzene", ring: { sides: 6, isAromatic: true } },
  { id: "cyclopentane", ring: { sides: 5, isAromatic: false } },
];

const GROUP_NAME: Record<FragmentId, (t: (s: string) => string) => string> = {
  oh: (t) => t("Hydroxyl group"),
  cooh: (t) => t("Carboxyl group"),
  nh2: (t) => t("Amino group"),
  cho: (t) => t("Aldehyde group"),
  ch3: (t) => t("Methyl group"),
};

// A ring as it is drawn: the polygon, and for benzene the inner line of each double bond.
function RingGlyph({ ring }: { ring: RingSpec }) {
  const cx = 15;
  const cy = 12;
  const r = 9; // the corners are on a circle of radius 9
  const corner = (i: number) => [cx + r * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / ring.sides), cy + r * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / ring.sides)];
  const corners = Array.from({ length: ring.sides }, (_, i) => corner(i));
  const inner = ring.isAromatic ? [0, 2, 4].map((i) => [corners[i], corners[(i + 1) % ring.sides]].map(([x, y]) => [x + (cx - x) * 0.28, y + (cy - y) * 0.28])) : [];
  return (
    <svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <polygon points={corners.map((c) => c.join(",")).join(" ")} />
      {inner.map(([[x1, y1], [x2, y2]], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </svg>
  );
}



function ToolButton({ tool, active, onPick, icon, label, hint }: { tool: StudioTool; active: StudioTool; onPick: (t: StudioTool) => void; icon: ReactNode; label: string; hint: string }) {
  const on = tool === active;
  return (
    <button
      onClick={() => onPick(tool)}
      aria-pressed={on}
      title={hint}
      data-tool={tool}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
    >
      {icon}
      {label}
    </button>
  );
}

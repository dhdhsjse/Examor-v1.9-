"use client";

import { ArrowRight, Check, CircleDot, Dot, Eraser, Table2, Type } from "lucide-react";
import type { HydrogenMode, LonePairMode, BondType } from "@/app/_lib/chemistry/types";
import type { ReactNode } from "react";
import { COMMON_ELEMENTS, PERIODIC_TABLE, elementName, textColor } from "@/app/_lib/chemistry/periodicTable";
import { FRAGMENTS, FRAGMENT_IDS, type FragmentId } from "@/app/_lib/chemistry/fragments";
import { TOOL_HINTS } from "@/app/_lib/chemistry/strings";
import type { RingSpec } from "@/app/_lib/chemistry/types";
import Disclosure from "@/app/_components/graph-studio/Disclosure";
import { Group, Segmented, held, idle, listRow, softButton, tileBase } from "@/app/_components/graph-studio/fields";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import { useUi } from "@/app/_lib/uiLang";
import { ALL_BOND_TYPES, useBondNames } from "./bondNames";
import { BondGlyph, ChemLabel } from "./glyphs";
import type { MoleculeStudioState, StudioTool } from "./useMoleculeStudio";

/** Where a new drawing can start from (only before anything is drawn: it would be lost). */
export interface StudioExamples {
  items: { id: string; name: string }[];
  current: string;
  disabled: boolean;
  onPick: (id: string) => void;
}

interface Props {
  studio: MoleculeStudioState;
  onOpenTable: () => void;
  /** The examples a new drawing can start from; none when a block is being edited. */
  examples?: StudioExamples;
}

// The bonds a teacher draws most come first (single, double, triple, wedge, dash), then the others.
const FIRST_BONDS: BondType[] = ["single", "double", "triple", "wedge", "dash"];
const BONDS: BondType[] = [...FIRST_BONDS, ...ALL_BOND_TYPES.filter((b) => !FIRST_BONDS.includes(b))];

// The left panel of the Studio, in the order a molecule is drawn: the atoms, the bonds (and the eraser), the rings, the groups. What is
// used less (the hydrogens, the lone pairs, texts and arrows, the shapes, the examples) is in sections that are closed at first.
// The help of the tool in hand is written on the paper itself; each button says what it is in its tooltip.
export default function StudioToolbar({ studio, onOpenTable, examples }: Props) {
  const { t, lang } = useUi();
  const { activeTool, setActiveTool, activeElement, pickElement, activeBondType, pickBond, activeRing, pickRing, activeTemplate, pickTemplate } = studio;
  const bondNames = useBondNames();
  const hydrogenModes: { value: HydrogenMode; label: string; title: string }[] = [
    { value: "manual", label: t("Manual"), title: t("Manual: nothing is added, you draw every bond yourself") },
    { value: "auto", label: t("Auto"), title: t("Auto: the missing hydrogens are added for you") },
    { value: "labels", label: t("Labels"), title: t("Labels: the missing hydrogens are written next to the atom (CH3, OH)") },
  ];
  const pairModes: { value: LonePairMode; label: string; title: string }[] = [
    { value: "off", label: t("Off"), title: t("Off: the lone pairs are not written") },
    { value: "dots", label: t("Dots"), title: t("Dots: each lone pair is two dots") },
    { value: "lines", label: t("Bars"), title: t("Bars: each lone pair is a short bar") },
  ];
  const pairTools = activeTool === "pair" || activeTool === "electron";
  const noteTools = activeTool === "text" || activeTool === "arrow" || activeTool === "shape";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="molecule-tools">
      <Disclosure title={t("Atoms")} testId="molecule-atoms">
        <div className="grid grid-cols-4 gap-1.5" dir="ltr" role="group" aria-label={t("Common elements")}>
          {COMMON_ELEMENTS.map((symbol) => {
            const e = PERIODIC_TABLE[symbol];
            const on = activeTool === "atom" && symbol === activeElement; // the brush is only "in hand" with the atom tool
            return (
              <button
                key={symbol}
                onClick={() => pickElement(symbol)}
                aria-pressed={on}
                title={`${elementName(e, lang)} — ${t(TOOL_HINTS.atom)}`}
                aria-label={`${symbol} — ${elementName(e, lang)}`}
                data-symbol={symbol}
                className={`${tileBase} h-9 text-[15px]! font-bold! ${on ? held : idle}`}
                style={{ color: on ? undefined : textColor(e.color) }}
              >
                {symbol}
              </button>
            );
          })}
        </div>
        {/* an element of the whole table that is in hand shows here, as it is not among the tiles */}
        <button onClick={onOpenTable} data-testid="all-elements" className={softButton}>
          <Table2 size={15} aria-hidden />
          {t("All elements")}
          {activeTool === "atom" && !COMMON_ELEMENTS.includes(activeElement) && (
            <span className="rounded-full bg-white px-2 text-xs font-bold text-accent-strong shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" data-testid="active-element">
              {activeElement}
            </span>
          )}
        </button>
      </Disclosure>

      <Disclosure title={t("Bonds")} testId="molecule-bonds">
        <div className="grid grid-cols-4 gap-1.5" dir="ltr">
          {BONDS.map((type) => {
            const on = activeTool === "bond" && activeBondType === type; // the bond type is only "in hand" with the bond tool
            return (
              <button key={type} onClick={() => pickBond(type)} aria-pressed={on} title={`${bondNames.full[type]} — ${t("Drag from an atom to draw a bond")}`} aria-label={bondNames.full[type]} data-bond-type={type} className={`${tileBase} h-9 ${on ? held : idle}`}>
                <BondGlyph type={type} />
              </button>
            );
          })}
          {/* (the eraser of the chemistry: it deletes atoms and bonds; the one of the floating bar rubs out the drawings) */}
          <ToolTile tool="erase" active={activeTool} onPick={setActiveTool} label={t("Eraser")} hint={t("Click an atom to delete it and its bonds")} icon={<Eraser size={16} />} iconOnly />
        </div>
      </Disclosure>

      <Disclosure title={t("Rings")} testId="molecule-rings">
        <div className="grid grid-cols-3 gap-1.5">
          {RING_BUTTONS.map(({ id, ring }) => {
            const on = activeTool === "ring" && activeRing.sides === ring.sides && activeRing.isAromatic === ring.isAromatic;
            const name = id === "benzene" ? t("Benzene") : id === "cyclohexane" ? t("Cyclohexane") : t("Cyclopentane");
            return (
              <button key={id} onClick={() => pickRing(ring)} aria-pressed={on} title={`${name} — ${t("Click the paper to place the ring")}`} aria-label={name} data-ring={id} className={`${tileBase} h-10 ${on ? held : idle}`}>
                <RingGlyph ring={ring} />
              </button>
            );
          })}
        </div>
      </Disclosure>

      <Disclosure title={t("Functional groups")} testId="molecule-groups">
        <div className="grid grid-cols-3 gap-1.5" dir="ltr">
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
                className={`${tileBase} h-9 text-[13px]! font-semibold! ${on ? held : idle}`}
              >
                <span>
                  <span className="font-normal text-faint">–</span>
                  <ChemLabel text={FRAGMENTS[id].label} />
                </span>
              </button>
            );
          })}
        </div>
      </Disclosure>

      <Disclosure title={t("Hydrogens")} testId="hydrogen-modes" defaultOpen={false}>
        <Segmented label={t("Hydrogens")} value={studio.hydrogenMode} options={hydrogenModes} onChange={studio.setHydrogenMode} attr="data-hydrogen-mode" />
        {studio.hydrogenMode !== "auto" && (
          <button onClick={studio.addMissingHydrogens} disabled={studio.graph.atoms.length === 0} data-testid="add-hydrogens" className={softButton}>
            {t("Add the missing hydrogens")}
          </button>
        )}
      </Disclosure>

      <Disclosure title={t("Lone pairs")} testId="lone-pair-modes" defaultOpen={false} reveal={pairTools ? activeTool : null}>
        <Segmented
          label={t("Lone pairs")}
          value={studio.lonePairMode}
          options={pairModes}
          onChange={(mode) => {
            studio.setLonePairMode(mode);
            // Dots or Bars: the next clicks put pairs; Off: back to Select
            if (mode !== "off") setActiveTool("pair");
            else if (activeTool === "pair") setActiveTool("select");
          }}
          attr="data-pair-mode"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <ToolTile
            tool="pair"
            active={activeTool}
            onPick={(tool) => {
              setActiveTool(tool);
              if (studio.lonePairMode === "off") studio.setLonePairMode("dots"); // (the pairs are written, or the tool would seem to do nothing)
            }}
            icon={<CircleDot size={16} />}
            label={t("Lone pair")}
            hint={`${t(TOOL_HINTS.pair)} · ${t("In Select mode, drag a pair to move it round its atom")}`}
          />
          <ToolTile tool="electron" active={activeTool} onPick={setActiveTool} icon={<Dot size={16} />} label={t("Single electron")} hint={t(TOOL_HINTS.electron)} />
        </div>
        <button onClick={studio.writeAllPairs} disabled={studio.graph.atoms.length === 0} title={t("Every atom gets the pairs its valence leaves, placed automatically")} data-testid="pairs-write-all" className={softButton}>
          {t("Write them all automatically")}
        </button>
      </Disclosure>

      <Disclosure title={t("Annotations")} testId="molecule-shapes" defaultOpen={false} reveal={noteTools ? activeTool : null}>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolTile tool="text" active={activeTool} onPick={setActiveTool} icon={<Type size={16} />} label={t("Text")} hint={t(TOOL_HINTS.text)} />
          <ToolTile tool="arrow" active={activeTool} onPick={setActiveTool} icon={<ArrowRight size={16} />} label={t("Arrow")} hint={t(TOOL_HINTS.arrow)} />
        </div>
        <ShapesMenuButton variant="row" active={activeTool === "shape"} current={activeTool === "shape" ? studio.shapeKind : null} onPick={studio.pickShape} />
      </Disclosure>

      {examples && (
        <Disclosure title={t("Examples")} testId="start-from" defaultOpen={false}>
          <Group label={t("Start from")}>
            {examples.items.map((x) => {
              const on = x.id === examples.current;
              return (
                <button key={x.id} onClick={() => examples.onPick(x.id)} disabled={examples.disabled && !on} aria-pressed={on} data-start={x.id} className={listRow(on)}>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em]">{x.name}</span>
                  {on && <Check size={15} strokeWidth={2.4} aria-hidden className="shrink-0" />}
                </button>
              );
            })}
          </Group>
        </Disclosure>
      )}
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

// A tool as a tile: its icon and its name (or the icon alone, the name in its tooltip).
function ToolTile({ tool, active, onPick, icon, label, hint, iconOnly = false }: { tool: StudioTool; active: StudioTool; onPick: (t: StudioTool) => void; icon: ReactNode; label: string; hint: string; iconOnly?: boolean }) {
  const on = tool === active;
  return (
    <button onClick={() => onPick(tool)} aria-pressed={on} title={hint} aria-label={iconOnly ? label : undefined} data-tool={tool} className={`${tileBase} ${iconOnly ? "h-9" : "h-11"} ${on ? held : idle}`}>
      {icon}
      {!iconOnly && label}
    </button>
  );
}

"use client";

import type Konva from "konva";
import { memo, useMemo, useState } from "react";
import { Circle, Group, Label, Line, Rect, Tag, Text } from "react-konva";
import { ATOM_HIT_RADIUS, bondDrawing } from "@/app/_lib/chemistry/bondGeometry";
import { hydrogenLabels, labelParts, type HydrogenLabel } from "@/app/_lib/chemistry/hydrogenLabel";
import { atomInStudentView, bondInStudentView } from "@/app/_lib/chemistry/masking";
import { PERIODIC_TABLE, textColor } from "@/app/_lib/chemistry/periodicTable";
import type { AtomNode, BondEdge, LonePairMode, MoleculeGraph } from "@/app/_lib/chemistry/types";
import { drawingIssues } from "@/app/_lib/chemistry/issues";
import { electronPosition, type ElectronClick } from "@/app/_lib/chemistry/electrons";
import { PAIR_DISTANCE, lonePairMarks, pairShape, pairsShownToStudents, type PairClick, type PairMark, type PairShape } from "@/app/_lib/chemistry/lonePairs";
import { useT } from "@/app/_lib/uiLang";
import { messagesByAtom } from "./issueMessages";
import type { StudioTool } from "./useMoleculeStudio";

export const INK = "#1f2937";
export const ACCENT = "#4f46e5"; // selected, and the bond being drawn
const ACCENT_SOFT = "#a5b4fc"; // under the mouse
const DANGER = "#dc2626"; // under the eraser
const BOND_WIDTH = 1.6;
const BOND_HIT_WIDTH = 14; // a bond is clicked within 7 units of its line, not only on the 1.6-wide stroke
const FONT = "Arial, Helvetica, sans-serif";
const FONT_SIZE = 20;
const CHARGE_SIZE = 12;
const BOX = 32; // the square the symbol is centred in
const RING_RADIUS = 18;
const MASKED_OPACITY = 0.5; // masked (hidden in the student version): drawn at half strength in the teacher's view…
const MASKED_RING = "#dc2626"; // …with a red dashed border
const MISSING_BOND = "#9ca3af"; // the dashed line that stands for a masked bond in the student view
const BLANK_BOX = 24; // the empty dashed box that stands for a masked atom with no replacement text
const WARNING = "#d97706"; // an atom with more bonds than its usual valence
const LABEL_BOX = 32;
const PAIR_HIT_RADIUS = 26; // with the lone pair tool an atom is clicked within this, so that the pair can be aimed beside it
const PAIR_GRAB_RADIUS = 8; // a lone pair is picked up within this of its middle
const ELECTRON_PREVIEW = 2.2;
const SYMBOL_REACH = 9; // a click this close to the middle of the atom is on its symbol, not beside it

// With these tools an atom is not clicked: what is clicked is the paper under it (a ring or a text may go there).
const PAPER_TOOLS: StudioTool[] = ["ring", "text", "arrow"];

// "+", "2+", "−", "3−" (a real minus sign).
const chargeText = (n: number) => `${Math.abs(n) > 1 ? Math.abs(n) : ""}${n > 0 ? "+" : "−"}`;

/** What the drawing area lets the teacher do with atoms and bonds. Without it the molecule is only drawn. */
export type Interaction = {
  tool: StudioTool;
  selectedAtoms: ReadonlySet<string>;
  selectedBonds: ReadonlySet<string>;
  /** A click (left button) on an atom; `shift`: Shift was held (adds to the selection or takes away). `deg`: the direction of the click from the atom's middle (degrees), null on its symbol. */
  onClick: (id: string, shift: boolean, deg: number | null) => void;
  /** What a click towards `deg` would do with the lone pair tool (null: nothing), to show it before the click. */
  previewPair: (id: string, deg: number) => PairClick;
  /** A lone pair is clicked (left button). */
  onPairClick: (id: string, mark: PairMark) => void;
  /** A lone pair is picked up, turned round its atom (`deg`: where the mouse is, from the atom's middle), and let go. */
  onPairGrab: (id: string) => void;
  onPairTurn: (id: string, index: number, deg: number) => void;
  onPairDrop: () => void;
  /** The electron tool: what a click towards `deg` would do (null: nothing), and a click on a single electron (the `index`th of the atom). */
  previewElectron: (id: string, deg: number) => ElectronClick;
  onElectronClick: (id: string, index: number) => void;
  /** The left button went down on an atom (the start of a bond with the bond tool). */
  onPress: (id: string) => void;
  /** The atom is picked up; `wholeMolecule` = Shift was held: the molecule it belongs to moves with it. */
  onDragStart: (id: string, wholeMolecule: boolean) => void;
  /** The atom is at (x, y) now; called all along the drag so the bonds follow. */
  onMove: (id: string, x: number, y: number) => void;
  /** The atom is let go: the drag is over. */
  onDragEnd: () => void;
  /** A click (left button) on a bond. */
  onBondClick: (id: string, shift: boolean) => void;
};

type Cursored = { target: { getStage: () => { container: () => HTMLElement } | null } };
const setCursor = (value: string) => (e: Cursored) => {
  const c = e.target.getStage()?.container();
  if (c) c.style.cursor = value;
};

// Where the mouse is from the middle of a node: the direction (degrees) and the distance (drawing units). null: the stage has no pointer.
function aimOf(node: Konva.Node): { deg: number; dist: number } | null {
  const p = node.getStage()?.getPointerPosition();
  if (!p) return null;
  const o = node.getAbsolutePosition();
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return { deg: (Math.atan2(dy, dx) * 180) / Math.PI, dist: Math.hypot(dx, dy) / (node.getAbsoluteScale().x || 1) };
}

const sameAim = (a: PairClick, b: PairClick) => a === b || (!!a && !!b && a.kind === b.kind && (a.kind === "add" ? a.angle === (b as typeof a).angle : a.mark.index === (b as typeof a).mark.index));

// One lone pair as it is drawn: two dots or a bar.
function PairDrawing({ shape, color, opacity = 1 }: { shape: PairShape; color: string; opacity?: number }) {
  return "dots" in shape ? (
    <Group opacity={opacity} listening={false}>
      {shape.dots.map((d, i) => (
        <Circle key={i} x={d.x} y={d.y} radius={d.r} fill={color} />
      ))}
    </Group>
  ) : (
    <Line points={[shape.bar.x1, shape.bar.y1, shape.bar.x2, shape.bar.y2]} stroke={color} strokeWidth={1.8} lineCap="round" opacity={opacity} listening={false} />
  );
}

function Atom({ atom, interaction, label, warnings, pairs, pairMode, student }: { atom: AtomNode; interaction?: Interaction; label?: HydrogenLabel; warnings?: string[]; pairs?: PairMark[]; pairMode?: LonePairMode; student?: boolean }) {
  const [hover, setHover] = useState(false);
  const [aim, setAim] = useState<PairClick>(null); // the lone pair tool: what a click here would do
  const [dotAim, setDotAim] = useState<ElectronClick>(null); // the electron tool: the same
  // An unknown symbol is still drawn (ink colour) rather than breaking the drawing.
  const color = textColor(PERIODIC_TABLE[atom.element]?.color ?? INK);
  const tool = interaction?.tool;
  const selected = !!interaction && interaction.selectedAtoms.has(atom.id);
  // The student's view: a masked atom is its replacement text (or an empty dashed box), and shows nothing else of it.
  const show = student ? atomInStudentView(atom) : null;
  const ring = selected ? ACCENT : hover && tool === "erase" ? DANGER : hover && (tool === "select" || tool === "bond" || tool === "template" || tool === "pair" || tool === "electron") ? ACCENT_SOFT : null;

  return (
    <Group
      x={atom.x}
      y={atom.y}
      opacity={!student && atom.hidden ? MASKED_OPACITY : 1}
      listening={!!interaction && !PAPER_TOOLS.includes(tool!)}
      draggable={tool === "select"}
      onMouseDown={(e) => {
        if (e.evt.button === 0) interaction?.onPress(atom.id);
      }}
      onClick={(e) => {
        if (e.evt.button !== 0) return; // the middle button pans; it is not a click on the atom
        e.cancelBubble = true; // the canvas behind must not also place an atom
        const at = aimOf(e.currentTarget);
        interaction?.onClick(atom.id, e.evt.shiftKey, at && at.dist >= SYMBOL_REACH ? at.deg : null);
      }}
      onDragStart={(e) => {
        if (e.evt.button !== 0) return e.target.stopDrag(); // only the left button moves an atom
        interaction?.onDragStart(atom.id, e.evt.shiftKey);
        setCursor("grabbing")(e);
      }}
      onDragMove={(e) => interaction?.onMove(atom.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => {
        setCursor("grab")(e);
        interaction?.onDragEnd();
      }}
      onMouseMove={(e) => {
        if ((tool !== "pair" && tool !== "electron") || !interaction) return;
        const at = aimOf(e.currentTarget);
        if (tool === "electron") {
          const next = at && at.dist >= SYMBOL_REACH ? interaction.previewElectron(atom.id, at.deg) : null;
          setDotAim((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
          return;
        }
        const next = at && at.dist >= SYMBOL_REACH ? interaction.previewPair(atom.id, at.deg) : null;
        setAim((prev) => (sameAim(prev, next) ? prev : next));
      }}
      onMouseEnter={(e) => {
        setHover(true);
        setCursor(tool === "select" ? "grab" : tool === "erase" ? "pointer" : "")(e);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        setAim(null);
        setDotAim(null);
        setCursor("")(e);
      }}
    >
      {ring && <Circle radius={RING_RADIUS} stroke={ring} strokeWidth={2} listening={false} />}
      {interaction && <Circle radius={tool === "pair" || tool === "electron" ? PAIR_HIT_RADIUS : ATOM_HIT_RADIUS} fill="transparent" />}
      {!student && atom.hidden && <Circle radius={RING_RADIUS - 1} stroke={MASKED_RING} strokeWidth={1.5} dash={[4, 3]} listening={false} />}
      {/* The symbol is centred on the atom: a BOX × BOX text whose middle is the atom's coordinate. */}
      {show?.kind === "mask" && show.text === "" && <Rect x={-BLANK_BOX / 2} y={-BLANK_BOX / 2} width={BLANK_BOX} height={BLANK_BOX} fill="#ffffff" stroke={INK} strokeWidth={1.3} dash={[4, 3]} listening={false} />}
      {show?.kind === "mask" && show.text !== "" && <Text text={show.text} width={BOX * 2} height={BOX} offsetX={BOX} offsetY={BOX / 2} align="center" verticalAlign="middle" fontFamily={FONT} fontStyle="bold" fontSize={FONT_SIZE} fill={INK} listening={false} />}
      {!show || show.kind === "normal" ? <Text text={atom.element} width={BOX} height={BOX} offsetX={BOX / 2} offsetY={BOX / 2} align="center" verticalAlign="middle" fontFamily={FONT} fontStyle="bold" fontSize={FONT_SIZE} fill={color} listening={false} /> : null}
      {/* the hydrogens of the "labels" mode: CH3 is the symbol, an H and a subscript */}
      {label && (!show || show.kind === "normal") &&
        labelParts(label).map((p, i) => (
          <Text key={i} text={p.text} x={p.x} y={p.y} width={LABEL_BOX} height={LABEL_BOX} offsetX={LABEL_BOX / 2} offsetY={LABEL_BOX / 2} align="center" verticalAlign="middle" fontFamily={FONT} fontStyle="bold" fontSize={p.size} fill={color} listening={false} />
        ))}
      {/* the lone pairs: two dots or a bar, in the free space around the atom (not for a masked atom in the student version) */}
      {pairs && pairMode && pairMode !== "off" && (!student || pairsShownToStudents(atom)) &&
        pairs.map((mark) => {
          const rad = (mark.angle * Math.PI) / 180;
          const live = !!interaction && !student && (tool === "select" || tool === "pair" || tool === "erase"); // (a pair is clicked or dragged with these)
          const doomed = aim?.kind === "remove" && aim.mark.index === mark.index; // the click would take this one away
          return (
            <Group
              key={mark.index}
              listening={live}
              draggable={live && tool === "select"}
              onClick={(e) => {
                if (e.evt.button !== 0) return;
                e.cancelBubble = true;
                interaction?.onPairClick(atom.id, mark);
              }}
              onDragStart={(e) => {
                e.cancelBubble = true; // (the atom is not picked up with it)
                if (e.evt.button !== 0) return e.target.stopDrag();
                interaction?.onPairGrab(atom.id);
                setCursor("grabbing")(e);
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const at = aimOf(e.target.getParent()!);
                e.target.position({ x: 0, y: 0 }); // (the pair is not moved: it is turned, and drawn again where its direction says)
                if (at) interaction?.onPairTurn(atom.id, mark.index, at.deg);
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                e.target.position({ x: 0, y: 0 });
                setCursor("")(e);
                interaction?.onPairDrop();
              }}
              onMouseEnter={(e) => setCursor(tool === "select" ? "grab" : "pointer")(e)}
              onMouseLeave={(e) => setCursor(tool === "select" ? "grab" : tool === "erase" ? "pointer" : "")(e)}
            >
              {live && <Circle x={Math.cos(rad) * PAIR_DISTANCE} y={Math.sin(rad) * PAIR_DISTANCE} radius={PAIR_GRAB_RADIUS} fill="transparent" />}
              <PairDrawing shape={pairShape(mark.angle, pairMode)} color={doomed ? DANGER : color} opacity={!student && atom.pairsHidden ? 0.4 : 1} />
            </Group>
          );
        })}
      {/* single electrons: one dot each, written whatever the lone pair mode is */}
      {(!student || pairsShownToStudents(atom)) &&
        (atom.dots ?? []).map((angle, index) => {
          const d = electronPosition(angle);
          const live = !!interaction && !student && (tool === "electron" || tool === "erase" || tool === "select");
          const doomed = dotAim?.kind === "remove" && dotAim.index === index;
          return (
            <Group
              key={"e" + index}
              listening={live}
              onClick={(e) => {
                if (e.evt.button !== 0) return;
                e.cancelBubble = true;
                interaction?.onElectronClick(atom.id, index);
              }}
            >
              {live && <Circle x={d.x} y={d.y} radius={PAIR_GRAB_RADIUS} fill="transparent" />}
              <Circle x={d.x} y={d.y} radius={d.r} fill={doomed ? DANGER : color} opacity={!student && atom.pairsHidden ? 0.4 : 1} listening={false} />
            </Group>
          );
        })}
      {dotAim?.kind === "add" && <Circle x={electronPosition(dotAim.angle).x} y={electronPosition(dotAim.angle).y} radius={ELECTRON_PREVIEW} fill={ACCENT} opacity={0.6} listening={false} />}
      {/* the lone pair tool: where the pair would go, before the click */}
      {aim?.kind === "add" && <PairDrawing shape={pairShape(aim.angle, pairMode && pairMode !== "off" ? pairMode : "dots")} color={ACCENT} opacity={0.6} />}
      {/* something odd about the atom (too many bonds…): a small "!", and why when the mouse is over the atom. Never a block. */}
      {warnings && warnings.length > 0 && interaction && (
        <>
          <Group x={-14} y={-15} listening={false}>
            <Circle radius={7} fill={WARNING} />
            <Text text="!" width={14} height={14} offsetX={7} offsetY={7} align="center" verticalAlign="middle" fontFamily={FONT} fontStyle="bold" fontSize={11} fill="#ffffff" />
          </Group>
          {hover && (
            <Label x={-8} y={-30} listening={false}>
              <Tag fill="#fffbeb" stroke={WARNING} strokeWidth={1} cornerRadius={4} pointerDirection="down" pointerWidth={8} pointerHeight={6} />
              <Text text={warnings.join("\n")} fontFamily={FONT} fontSize={11} padding={5} fill="#78350f" />
            </Label>
          )}
        </>
      )}
      {atom.charge !== 0 && (!show || show.kind === "normal") && <Text text={chargeText(atom.charge)} x={9} y={-19} fontFamily={FONT} fontStyle="bold" fontSize={CHARGE_SIZE} fill={color} listening={false} />}
    </Group>
  );
}

function Bond({ bond, a, b, interaction, student }: { bond: BondEdge; a: AtomNode; b: AtomNode; interaction?: Interaction; student?: boolean }) {
  const [hover, setHover] = useState(false);
  const tool = interaction?.tool;
  const selected = !!interaction && interaction.selectedBonds.has(bond.id);
  // Only the tools that work on bonds feel them; with any other a bond is just a drawing, and a click on it
  // goes to the paper (places an atom, a ring, a group, a text there).
  const live = !!interaction && (tool === "select" || tool === "erase" || tool === "bond");
  const show = student ? bondInStudentView(bond, a, b) : null;
  if (show?.kind === "omit") return null;
  const { lines, polygon, parts } = bondDrawing(a, b, show?.kind === "missing" ? "single" : bond.type);
  const line = [a.x, a.y, b.x, b.y];
  return (
    <Group
      listening={live}
      opacity={!student && bond.hidden ? MASKED_OPACITY : 1}
      onClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        interaction?.onBondClick(bond.id, e.evt.shiftKey);
      }}
      onMouseEnter={(e) => {
        setHover(true);
        setCursor("pointer")(e);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        setCursor("")(e);
      }}
    >
      {/* the click target and the highlight are wider than the bond itself; the atoms are drawn over them */}
      {live && (hover || selected) && <Line points={line} stroke={tool === "erase" && hover ? DANGER : ACCENT} opacity={selected ? 0.4 : 0.3} strokeWidth={9} lineCap="round" listening={false} />}
      {live && <Line points={line} stroke="transparent" strokeWidth={BOND_HIT_WIDTH} />}
      {!student && bond.hidden && <Line points={line} stroke={MASKED_RING} strokeWidth={5} opacity={0.35} dash={[5, 4]} lineCap="round" listening={false} />}
      {show?.kind === "missing" ? (
        lines.map((l, i) => <Line key={i} points={[l.x1, l.y1, l.x2, l.y2]} stroke={MISSING_BOND} strokeWidth={BOND_WIDTH} dash={[5, 4]} listening={false} />)
      ) : (
        <>
          {polygon && <Line points={polygon} closed fill={INK} stroke={INK} strokeWidth={0.5} lineJoin="round" listening={false} />}
          {lines.map((l, i) => (
            <Line key={i} points={[l.x1, l.y1, l.x2, l.y2]} stroke={INK} strokeWidth={BOND_WIDTH} lineCap="round" listening={false} />
          ))}
          {parts?.map((p, i) =>
            p.kind === "line" ? (
              <Line key={i} points={[p.seg.x1, p.seg.y1, p.seg.x2, p.seg.y2]} stroke={INK} strokeWidth={p.width ?? BOND_WIDTH} dash={p.dash} lineCap={p.round ? "round" : "butt"} listening={false} />
            ) : p.kind === "outline" ? (
              <Line key={i} points={p.points} closed fill="#ffffff" stroke={INK} strokeWidth={BOND_WIDTH} lineJoin="round" listening={false} />
            ) : p.kind === "polyline" ? (
              <Line key={i} points={p.points} stroke={INK} strokeWidth={BOND_WIDTH} lineJoin="round" listening={false} />
            ) : (
              <Line key={i} points={p.points} closed fill={INK} stroke={INK} strokeWidth={0.5} lineJoin="round" listening={false} />
            ),
          )}
        </>
      )}
    </Group>
  );
}

// A molecule graph on the Konva stage: bonds first, then the atoms over them.
// Bonds are computed from the atoms' current coordinates on every render, so they follow a dragged atom.
// They stop short of the atom symbols (bondDrawing), and double / triple bonds are parallel lines.
// `student`: the student's view of the drawing, with the masks applied (masking.ts); never with interaction.
function MoleculeRenderer({ graph, interaction, student }: { graph: MoleculeGraph; interaction?: Interaction; student?: boolean }) {
  const byId = useMemo(() => new Map(graph.atoms.map((a) => [a.id, a])), [graph.atoms]);
  const labels = useMemo(() => hydrogenLabels(graph), [graph]);
  const t = useT();
  const warnings = useMemo(() => (interaction ? messagesByAtom(drawingIssues(graph), t) : new Map<string, string[]>()), [graph, interaction, t]);
  const marks = useMemo(() => {
    const byAtom = new Map<string, PairMark[]>();
    for (const m of lonePairMarks(graph)) byAtom.set(m.atomId, [...(byAtom.get(m.atomId) ?? []), m]);
    return byAtom;
  }, [graph]);
  return (
    <Group>
      {graph.bonds.map((bond) => {
        const a = byId.get(bond.sourceId);
        const b = byId.get(bond.targetId);
        if (!a || !b) return null; // a bond to a missing atom is skipped, never a crash
        return <Bond key={bond.id} bond={bond} a={a} b={b} interaction={interaction} student={student} />;
      })}
      {graph.atoms.map((atom) => (
        <Atom key={atom.id} atom={atom} interaction={interaction} label={labels.get(atom.id)} warnings={warnings.get(atom.id)} pairs={marks.get(atom.id)} pairMode={graph.lonePairs} student={student} />
      ))}
    </Group>
  );
}

export default memo(MoleculeRenderer);

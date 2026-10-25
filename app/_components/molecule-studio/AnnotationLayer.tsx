"use client";

import { memo, useMemo } from "react";
import { Arrow, Circle, Group, Rect, Text } from "react-konva";
import { layoutChemText, type Measure } from "@/app/_lib/chemistry/chemText";
import { ARROW_DEFAULT_WIDTH, ARROW_MIN_WIDTH, LABEL_GAP, LABEL_SIZE, TEXT_SIZE } from "@/app/_lib/chemistry/geometry";
import type { CanvasAnnotation } from "@/app/_lib/chemistry/types";
import { ACCENT, INK } from "./MoleculeRenderer";
import type { StudioTool } from "./useMoleculeStudio";

const FONT = "Arial, Helvetica, sans-serif";
const HANDLE_RADIUS = 6;
const ARROW_WIDTH = 2;
const PAD = 4;
const MIN_TEXT_BOX = 28;

/** What the drawing area lets the teacher do with the texts and arrows. */
export type AnnotationInteraction = {
  tool: StudioTool;
  selectedIds: ReadonlySet<string>;
  /** The text or arrow being typed in: its Konva drawing is hidden under the editor. */
  editingId: string | null;
  /** Click on a text or arrow; `shift` adds it to the selection or takes it away. */
  onSelect: (id: string, shift: boolean) => void;
  /** A text or arrow (or the end of an arrow) is picked up and let go: one step of the history. */
  onGrab: (id: string) => void;
  onRelease: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number) => void;
  onEdit: (id: string) => void;
  onErase: (id: string) => void;
};

// The width of a text on the page, measured with a canvas (shared: creating one for each text is slow).
let measureContext: CanvasRenderingContext2D | null = null;
const measure: Measure = (text, size) => {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * size * 0.55;
  measureContext.font = `${size}px ${FONT}`;
  return measureContext.measureText(text).width;
};

// One line of chemistry text: "H2SO4" drawn as H₂SO₄. `centered`: the line is centred on x = 0.
function ChemLine({ text, fontSize, centered }: { text: string; fontSize: number; centered?: boolean }) {
  const layout = useMemo(() => layoutChemText(text, fontSize, measure), [text, fontSize]);
  return (
    <Group x={centered ? -layout.width / 2 : 0} listening={false}>
      {layout.items.map((item, i) => (
        <Text key={i} text={item.text} x={item.x} y={item.y} fontSize={item.fontSize} fontFamily={FONT} fill={INK} wrap="none" />
      ))}
    </Group>
  );
}

// Texts and arrows are only clicked while a tool that uses them is active, so that the others can draw over them.
const isLive = (tool: StudioTool, note: CanvasAnnotation) => tool === "select" || tool === "erase" || (tool === "text" && note.type === "text");

function Note({ note, interaction }: { note: CanvasAnnotation; interaction: AnnotationInteraction }) {
  const { tool, selectedIds, editingId } = interaction;
  const live = isLive(tool, note);
  const selected = selectedIds.has(note.id) && tool === "select";
  const hidden = editingId === note.id;
  const text = note.text ?? "";
  const width = note.width ?? ARROW_DEFAULT_WIDTH;
  const lineWidth = useMemo(() => layoutChemText(text, note.type === "arrow" ? LABEL_SIZE : TEXT_SIZE, measure).width, [text, note.type]);

  return (
    <Group
      x={note.x}
      y={note.y}
      opacity={hidden ? 0 : 1}
      listening={live}
      draggable={tool === "select"}
      onClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true; // the paper behind must not also place something
        if (tool === "erase") interaction.onErase(note.id);
        else if (tool === "text") interaction.onEdit(note.id);
        else interaction.onSelect(note.id, e.evt.shiftKey);
      }}
      onDblClick={(e) => {
        if (e.evt.button === 0 && (tool === "select" || tool === "text")) interaction.onEdit(note.id);
      }}
      onDragStart={(e) => e.currentTarget === e.target && interaction.onGrab(note.id)}
      onDragEnd={(e) => e.currentTarget === e.target && interaction.onRelease()}
      onDragMove={(e) => {
        if (e.currentTarget === e.target) interaction.onMove(note.id, e.target.x(), e.target.y()); // not the arrow's own handle
      }}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = tool === "erase" ? "pointer" : tool === "select" ? "move" : "text";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "";
      }}
    >
      {note.type === "text" ? (
        <>
          {/* a box a bit larger than the text: something to click and drag even when the text is short or empty */}
          <Rect x={-PAD} y={-PAD / 2} width={Math.max(lineWidth, MIN_TEXT_BOX) + 2 * PAD} height={TEXT_SIZE * 1.3 + PAD} fill="transparent" stroke={selected ? ACCENT : undefined} strokeWidth={1} dash={[4, 3]} />
          <ChemLine text={text} fontSize={TEXT_SIZE} />
        </>
      ) : (
        <>
          <Arrow points={[0, 0, width, 0]} stroke={INK} fill={INK} strokeWidth={ARROW_WIDTH} pointerLength={12} pointerWidth={10} hitStrokeWidth={18} lineCap="round" />
          {/* the conditions, centred above the arrow */}
          <Group x={width / 2} y={-(LABEL_SIZE * 1.2 + LABEL_GAP)}>
            <ChemLine text={text} fontSize={LABEL_SIZE} centered />
          </Group>
          {selected && (
            <Circle
              x={width}
              y={0}
              radius={HANDLE_RADIUS}
              fill="#ffffff"
              stroke={ACCENT}
              strokeWidth={2}
              draggable
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = "ew-resize";
              }}
              onClick={(e) => (e.cancelBubble = true)}
              onDragStart={() => interaction.onGrab(note.id)}
              onDragEnd={() => interaction.onRelease()}
              onDragMove={(e) => {
                // the end moves along the arrow only, and never closer than the minimum
                const w = Math.max(ARROW_MIN_WIDTH, e.target.x());
                e.target.x(w);
                e.target.y(0);
                interaction.onResize(note.id, w);
              }}
            />
          )}
        </>
      )}
    </Group>
  );
}

// Every text and arrow of the drawing.
function AnnotationLayer({ annotations, interaction }: { annotations: CanvasAnnotation[]; interaction: AnnotationInteraction }) {
  return (
    <Group>
      {annotations.map((note) => (
        <Note key={note.id} note={note} interaction={interaction} />
      ))}
    </Group>
  );
}

export default memo(AnnotationLayer);

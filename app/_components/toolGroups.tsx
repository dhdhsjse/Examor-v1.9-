import type { ReactNode } from "react";
import * as Icon from "./icons";
import type { Tone } from "./ToolTile";
import type { Subject } from "./TopBar";

export interface Tool {
  label: string;
  icon: ReactNode;
  onClick?: () => void; // missing = not built yet ("Soon")
}

export interface ToolGroup {
  title: string;
  tone: Tone;
  tools: Tool[];
}

// Extra tools for each subject (all "Soon" for now).
const SUBJECT_TOOLS: Record<Exclude<Subject, "General">, Tool[]> = {
  Math: [
    { label: "Function graph", icon: <Icon.GraphIcon /> },
    { label: "Geometry", icon: <Icon.GeometryIcon /> },
    { label: "Number line", icon: <Icon.NumberLineIcon /> },
    { label: "Fraction", icon: <Icon.FractionIcon /> },
  ],
  Physics: [
    { label: "Circuit", icon: <Icon.CircuitIcon /> },
    { label: "Vectors", icon: <Icon.VectorIcon /> },
    { label: "Units", icon: <Icon.RulerIcon /> },
    { label: "Lab setup", icon: <Icon.FlaskIcon /> },
  ],
  Sciences: [
    { label: "Label diagram", icon: <Icon.LabelIcon /> },
    { label: "Cell / organ", icon: <Icon.CellIcon /> },
    { label: "Classification", icon: <Icon.TreeIcon /> },
    { label: "Experiment", icon: <Icon.FlaskIcon /> },
  ],
  Arabic: [
    { label: "Arabic text", icon: <Icon.RtlTextIcon /> },
    { label: "Tashkeel", icon: <Icon.ArabicLetterIcon /> },
    { label: "Poetry verse", icon: <Icon.VerseIcon /> },
    { label: "I'rab table", icon: <Icon.TableIcon /> },
  ],
  French: [
    { label: "Conjugation", icon: <Icon.TableIcon /> },
    { label: "Dictation", icon: <Icon.PenLinesIcon /> },
    { label: "Reading text", icon: <Icon.BookIcon /> },
    { label: "Grammar", icon: <Icon.BlankIcon /> },
  ],
};

// Groups shown in the toolbox: subject tools first, then the shared ones.
// "General" shows only the shared groups.
export function getToolGroups(subject: Subject, actions: { addMcq: () => void }): ToolGroup[] {
  const shared: ToolGroup[] = [
    {
      title: "Questions",
      tone: "indigo",
      tools: [
        { label: "Multiple choice", icon: <Icon.McqIcon />, onClick: actions.addMcq },
        { label: "True / False", icon: <Icon.TrueFalseIcon /> },
        { label: "Fill the blank", icon: <Icon.BlankIcon /> },
        { label: "Open question", icon: <Icon.OpenQuestionIcon /> },
      ],
    },
    {
      title: "Insert",
      tone: "amber",
      tools: [
        { label: "Equation", icon: <Icon.EquationIcon /> },
        { label: "Image", icon: <Icon.ImageIcon /> },
        { label: "Table", icon: <Icon.TableIcon /> },
        { label: "Diagram", icon: <Icon.DiagramIcon /> },
      ],
    },
  ];

  if (subject === "General") return shared;
  return [{ title: `${subject} tools`, tone: "emerald", tools: SUBJECT_TOOLS[subject] }, ...shared];
}

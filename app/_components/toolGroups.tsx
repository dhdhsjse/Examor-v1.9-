import type { ReactNode } from "react";
import type { SchoolSubject, Subject } from "@/app/_lib/subjects";
import type { ToolAction } from "@/app/_lib/tools";
import * as Icon from "./icons";
import type { Tone } from "./ToolTile";

export interface Tool {
  label: string;
  icon: ReactNode;
  action: ToolAction;
}

export interface ToolGroup {
  title: string; // English: translated when shown
  subject?: SchoolSubject; // the subject group (title = "<subject> tools")
  tone: Tone;
  tools: Tool[];
}

const block = (type: Extract<ToolAction, { kind: "block" }>["type"], preset?: Extract<ToolAction, { kind: "block" }>["preset"]): ToolAction => ({
  kind: "block",
  type,
  preset,
});
const asset = (assetId: string): ToolAction => ({ kind: "asset", assetId });

// Extra tools for each subject.
const SUBJECT_TOOLS: Record<SchoolSubject, Tool[]> = {
  Math: [
    { label: "Function graph", icon: <Icon.GraphIcon />, action: block("graph") },
    { label: "Geometry", icon: <Icon.GeometryIcon />, action: asset("math-triangle") },
    { label: "Number line", icon: <Icon.NumberLineIcon />, action: asset("math-numberline") },
    { label: "Fraction", icon: <Icon.FractionIcon />, action: block("equation", { latex: "\\frac{a}{b}+\\frac{c}{d}=\\frac{\\ldots}{\\ldots}" }) },
  ],
  Physics: [
    { label: "Circuit", icon: <Icon.CircuitIcon />, action: asset("phys-circuit") },
    { label: "Forces", icon: <Icon.VectorIcon />, action: asset("phys-incline") },
    { label: "Units", icon: <Icon.RulerIcon />, action: asset("table-units") },
    { label: "Optics", icon: <Icon.FlaskIcon />, action: asset("phys-lens") },
  ],
  Sciences: [
    { label: "Cell diagram", icon: <Icon.CellIcon />, action: asset("sci-cell") },
    { label: "Food chain", icon: <Icon.LabelIcon />, action: asset("sci-foodchain") },
    { label: "Water cycle", icon: <Icon.FlaskIcon />, action: asset("sci-watercycle") },
    { label: "Classification", icon: <Icon.TreeIcon />, action: asset("table-classify") },
  ],
  Arabic: [
    { label: "Arabic text", icon: <Icon.RtlTextIcon />, action: block("text", { style: "body", text: "اقرأ النص التالي ثم أجب عن الأسئلة :" }) },
    { label: "Tashkeel", icon: <Icon.ArabicLetterIcon />, action: block("open", { text: "اشكل الجملة التالية شكلا تاما :", lines: 2, points: 2 }) },
    { label: "Poetry verse", icon: <Icon.VerseIcon />, action: block("text", { style: "body", text: "صدر البيت .....................          عجز البيت ....................." }) },
    { label: "I'rab table", icon: <Icon.TableIcon />, action: asset("table-irab") },
  ],
  French: [
    { label: "Conjugation", icon: <Icon.TableIcon />, action: asset("table-conjugation") },
    { label: "Dictation", icon: <Icon.PenLinesIcon />, action: block("open", { text: "Dictée", lines: 10, points: 5 }) },
    { label: "Reading text", icon: <Icon.BookIcon />, action: block("text", { style: "body", text: "Lisez attentivement le texte suivant, puis répondez aux questions." }) },
    { label: "Grammar", icon: <Icon.BlankIcon />, action: block("blank", { text: "Complétez avec le bon déterminant :", content: "[Le] chat dort sur [la] chaise." }) },
  ],
};

const SHARED: ToolGroup[] = [
  {
    title: "Questions",
    tone: "indigo",
    tools: [
      { label: "Multiple choice", icon: <Icon.McqIcon />, action: block("mcq") },
      { label: "True / False", icon: <Icon.TrueFalseIcon />, action: block("truefalse") },
      { label: "Fill the blank", icon: <Icon.BlankIcon />, action: block("blank") },
      { label: "Open question", icon: <Icon.OpenQuestionIcon />, action: block("open") },
    ],
  },
  {
    title: "Insert",
    tone: "amber",
    tools: [
      { label: "Heading", icon: <Icon.HeadingIcon />, action: block("text", { style: "heading" }) },
      { label: "Paragraph", icon: <Icon.RtlTextIcon />, action: block("text", { style: "body" }) },
      { label: "Equation", icon: <Icon.EquationIcon />, action: block("equation") },
      { label: "Table", icon: <Icon.TableIcon />, action: block("table") },
      { label: "Graph", icon: <Icon.GraphIcon />, action: block("graph") },
      { label: "Image", icon: <Icon.ImageIcon />, action: { kind: "importImage" } },
      { label: "Diagram", icon: <Icon.DiagramIcon />, action: { kind: "library" } },
      { label: "Exam header", icon: <Icon.HeaderIcon />, action: block("header") },
    ],
  },
];

// Groups shown in the toolbox: subject tools first, then the shared ones.
// "General" shows only the shared groups.
export function getToolGroups(subject: Subject): ToolGroup[] {
  if (subject === "General") return SHARED;
  return [{ title: `${subject} tools`, subject, tone: "emerald", tools: SUBJECT_TOOLS[subject] }, ...SHARED];
}

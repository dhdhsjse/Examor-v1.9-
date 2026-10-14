// Language of the exam content. "ar" = Arabic, written right-to-left.
export type Lang = "fr" | "ar";

// "exam" = the student copy, "key" = the correction sheet (answers shown).
export type ViewMode = "exam" | "key";

// One A4 sheet of the exam.
export interface Page {
  id: string;
}

// Where a block sits (page pixels, relative to its own page).
// `height` is only used by blocks with a fixed size (image, equation);
// the others compute their height from their content.
export interface BlockLayout {
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BlockBase {
  id: string;
  layout: BlockLayout;
}

// ---- Questions (they have points and a correct answer) ----

export interface McqBlock extends BlockBase {
  type: "mcq";
  text: string;
  options: string[];
  correct: number; // index into `options`
  points: number;
}

export interface TrueFalseBlock extends BlockBase {
  type: "truefalse";
  text: string;
  statements: { text: string; answer: boolean }[];
  points: number;
}

// Fill in the blank: answers are written in [brackets] inside `content`.
export interface BlankBlock extends BlockBase {
  type: "blank";
  text: string;
  content: string;
  points: number;
}

export interface OpenBlock extends BlockBase {
  type: "open";
  text: string;
  lines: number; // answer lines for the student
  answer: string; // model answer (correction sheet)
  points: number;
}

// ---- Content blocks ----

export type TextStyle = "title" | "heading" | "body";

export interface TextBlock extends BlockBase {
  type: "text";
  text: string;
  style: TextStyle;
}

export interface EquationBlock extends BlockBase {
  type: "equation";
  latex: string;
  svg: string; // rendered by MathJax
  exW: number; // natural size of the svg, in "ex" units
  exH: number;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string; // data URL (imported image or library diagram)
  ratio: number; // width / height
}

export interface TableBlock extends BlockBase {
  type: "table";
  cells: string[][];
  header: boolean; // first row in bold
}

export type HeaderStyle = "classic" | "modern" | "minimal";

export interface HeaderFields {
  school: string;
  title: string;
  subject: string;
  level: string;
  duration: string;
  year: string;
  outOf: number; // score is "... / outOf"
}

export interface HeaderBlock extends BlockBase {
  type: "header";
  style: HeaderStyle;
  fields: HeaderFields;
}

export type QuestionBlock = McqBlock | TrueFalseBlock | BlankBlock | OpenBlock;
export type Block = QuestionBlock | TextBlock | EquationBlock | ImageBlock | TableBlock | HeaderBlock;
export type BlockType = Block["type"];

// The editable fields of any one block type, all optional (used for changes and presets).
export type BlockData = {
  [B in Block as B["type"]]: Partial<Omit<B, "id" | "layout" | "type">>;
}[BlockType];

export interface ExamMeta {
  title: string;
  lang: Lang;
  templateId: string;
}

// The whole exam, as saved to disk.
export interface ExamDoc {
  version: 1;
  meta: ExamMeta;
  pages: Page[];
  blocks: Block[];
}

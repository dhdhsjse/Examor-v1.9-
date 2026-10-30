import type { JSONContent } from "@tiptap/core";
import type { MoleculeGraph } from "@/app/_lib/chemistry/types";
import type { CircuitConfig } from "@/app/_lib/circuit/types";
import type { GraphConfig } from "@/app/_lib/graph/types";
import type { MoleculeBlockData } from "@/app/_molecule/model";

// Language of the exam content. "ar" = Arabic, written right-to-left.
export type Lang = "fr" | "ar";

// "exam" = the student copy, "key" = the correction sheet (answers shown).
export type ViewMode = "exam" | "key";

// One sheet of the exam.
export interface Page {
  id: string;
  margins?: PageMargins; // missing = 48px on every side
  format?: PageFormat; // missing = A4 portrait
  header?: HeaderFooterConfig; // this page's own header (Page layout → Header and footer); missing = the document's
  footer?: HeaderFooterConfig;
}

// A header or footer: a template of the header/footer library (onboarding/headerFooterLibrary.ts) and
// the texts typed for it (`data`, by field key; missing = the template's default text).
export interface HeaderFooterConfig {
  enabled: boolean;
  templateId: string;
  data: Record<string, string>;
}

export type PageOrientation = "portrait" | "landscape";
export type PageSizeKey = "A4" | "A3" | "A5" | "Letter" | "Legal" | "custom";

// Paper size of a page (Page layout → Page format). Sizes are portrait; "landscape" swaps them.
export interface PageFormat {
  size: PageSizeKey;
  orientation: PageOrientation;
  customWidth?: number; // mm, only with size "custom"
  customHeight?: number;
}

// Printable-area margins of a page (page pixels).
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Which pages carry a header or a footer.
// "pages" lists page numbers (1 = first page).
export type PageScope = { mode: "all" | "first" | "none" } | { mode: "pages"; pages: number[] };

// The header/footer choices made in the onboarding wizard (kept so new pages follow them).
export interface ChromeRule {
  header: PageScope;
  footer: PageScope;
  headerId?: string;
  footerId?: string;
}

// Marks a block placed by the onboarding wizard as a page header or footer.
export interface BlockMeta {
  role?: "header" | "footer";
  templateId?: string;
  field?: string; // a header/footer text block: the text of its settings it shows (HeaderFooterConfig.data key)
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

// Font of a whole block (missing = the exam's default font).
export interface BlockFont {
  family?: string; // one of FONT_CHOICES (see fonts.ts)
  size?: number; // main text size in px
  color?: string;
  // Home → Formatting, for the whole block (single words are styled in the text itself, see richText.ts)
  bold?: boolean; // missing = the block's own (titles bold, the rest not)
  italic?: boolean;
  underline?: boolean;
  strike?: boolean; // struck through
  lineHeight?: number; // line spacing, times the normal one (1, 1.15, 1.5, 2)
}

interface BlockBase {
  id: string;
  layout: BlockLayout;
  font?: BlockFont;
  meta?: BlockMeta; // missing in older files
}

// ---- Questions (they have points and a correct answer) ----

export interface McqBlock extends BlockBase {
  type: "mcq";
  text: string;
  options: string[];
  correct: number; // index into `options` (one correct answer)
  points: number;
  multi?: boolean; // several correct answers: square boxes, the answers are in `corrects`
  corrects?: number[];
  columns?: number; // options side by side, 1–4 (missing = 1)
}

export interface TrueFalseStatement {
  text: string;
  answer: boolean;
  fix?: string; // the corrected statement, shown on the correction sheet (with `justify`)
}

export interface TrueFalseBlock extends BlockBase {
  type: "truefalse";
  text: string;
  statements: TrueFalseStatement[];
  points: number;
  justify?: boolean; // a line under each statement to correct the false ones
}

// Fill in the blank: answers are written in [brackets] inside `content`.
export interface BlankBlock extends BlockBase {
  type: "blank";
  text: string;
  content: string;
  points: number;
  wordBank?: boolean; // show the answers (mixed up) in a box above the text
  distractors?: string[]; // extra wrong words for the box
}

// What the student writes on: dotted lines, plain lines, squared paper, an empty frame, or nothing.
export type AnswerStyle = "dotted" | "lines" | "grid" | "box" | "none";

// Match each item on the left with one on the right. `order` is the order in which the right
// items are printed (indexes into `pairs`), so the matches aren't side by side.
export interface MatchPair {
  left: string;
  right: string;
}

export interface MatchBlock extends BlockBase {
  type: "match";
  text: string;
  pairs: MatchPair[];
  order: number[];
  points: number;
}

// Put items back in order. `items` is the right order, `order` the mixed-up printed order.
// "list": a box before each item for its rank; "sentence": mixed-up words to write as a sentence.
export interface OrderBlock extends BlockBase {
  type: "order";
  text: string;
  items: string[];
  order: number[];
  points: number;
  style?: "list" | "sentence"; // missing = "list"
}

// Sort words into categories: the words are given in a box, the student fills a table.
export interface ClassifyGroup {
  name: string;
  items: string[];
}

export interface ClassifyBlock extends BlockBase {
  type: "classify";
  text: string;
  groups: ClassifyGroup[];
  points: number;
  hideBank?: boolean; // don't print the box of words (the student finds them, e.g. in a text)
}

// A sub-question of an open question: "1a)", "1b)"...
export interface OpenPart {
  label?: string; // own name instead of the automatic "1a)" (empty = automatic)
  text: string;
  lines: number;
  answer: string;
  points: number;
}

export interface OpenBlock extends BlockBase {
  type: "open";
  text: string;
  lines: number; // answer lines for the student
  answer: string; // model answer (correction sheet)
  points: number; // total (= sum of the parts when there are parts)
  parts?: OpenPart[]; // missing in files from older versions
  partNumbering?: PartNumbering; // missing = "1a"
  context?: string; // statement printed under the question, before the answer (data, a text, a situation…)
  answerStyle?: AnswerStyle; // missing = "dotted"
}

// How sub-questions are numbered: 1a) · a) · 1.1) · i) · 1) · nothing.
export type PartNumbering = "1a" | "a" | "1.1" | "i" | "1" | "none";

// ---- Content blocks ----

export type TextStyle = "title" | "heading" | "body";

// Look of a title / heading: a plain text, or a modern decoration around it.
export type HeadingDecor = "plain" | "underline" | "bar" | "band" | "pill" | "boxed" | "rule";

// Alignment of a paragraph of text.
export type ParagraphAlign = "left" | "center" | "right" | "justify";

export interface TextBlock extends BlockBase {
  align?: ParagraphAlign; // missing = titles centered, the rest along the writing direction
  type: "text";
  text: string;
  style: TextStyle;
  decor?: HeadingDecor; // missing = "plain"
  accent?: string; // color of the decoration
}

export interface EquationBlock extends BlockBase {
  type: "equation";
  latex: string;
  svg: string; // rendered by MathJax
  exW: number; // natural size of the svg, in "ex" units
  exH: number;
}

// A library figure drawn from settings the teacher can change (the angles of a triangle…).
// `id` names the figure in app/_lib/figures; `params` are its settings.
export type FigureValue = number | string | boolean;

export interface FigureSpec {
  id: string;
  params: Record<string, FigureValue>;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string; // data URL (imported image or library diagram)
  ratio: number; // width / height
  figure?: FigureSpec; // a library figure: `src` is redrawn when its settings change
  molecule?: MoleculeBlockData; // a molecule from the Molecule Studio: `src` is its drawing, redrawn on edit
  drawing?: MoleculeGraph; // a drawing made by hand in the drawing Studio: `src` is its picture, redrawn on edit
  graphStudio?: GraphConfig; // a graph paper from the Graph Studio: `src` is its picture, redrawn on edit
  circuitStudio?: CircuitConfig; // a circuit from the Circuit Studio: `src` is its picture, redrawn on edit
}

export interface TableBlock extends BlockBase {
  type: "table";
  cells: string[][];
  header: boolean; // first row in bold
  colWidths?: number[]; // share of the width of each column (missing = equal columns)
  rowHeights?: number[]; // minimum height of each row in px (0 or missing = fits the text)
}

// A function graph drawn from formulas typed by the teacher, e.g. "x^2 - 2".
export interface GraphBlock extends BlockBase {
  type: "graph";
  functions: string[]; // any number of curves
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  grid: boolean;
}

export type HeaderStyle =
  | "classic"
  | "modern"
  | "minimal"
  | "banner"
  | "elegant"
  | "official"
  | "split"
  | "compact"
  | "evaluation"
  | "playful"
  | "cards"
  | "accentbar"
  | "bookmark"
  | "gradient"
  | "geometric"
  | "chips"
  | "editorial"
  | "framed"
  | "infogrid"
  | "duotone"
  | "monogram"
  | "ticket"
  | "floating"
  | "algerian";

export interface HeaderFields {
  authority?: string; // top line of the official header, e.g. the ministry (missing in older files)
  republic?: string; // first line of the Algerian header ("République Algérienne…")
  directorate?: string; // Algerian header: "Direction de l'Éducation de la wilaya de …"
  school: string;
  title: string;
  subject: string;
  level: string;
  duration: string;
  year: string;
  outOf: number; // score is "... / outOf"
  autoOutOf?: boolean; // use the total points of the questions instead of `outOf`
}

export interface HeaderBlock extends BlockBase {
  type: "header";
  style: HeaderStyle;
  fields: HeaderFields;
  accent?: string; // main color of the colored styles (missing = each style's own color)
  aligns?: Partial<Record<string, TextAlign>>; // alignment chosen for a text of the header, by field key
}

export type TextAlign = "left" | "center" | "right";

export type QuestionBlock = McqBlock | TrueFalseBlock | BlankBlock | OpenBlock | MatchBlock | OrderBlock | ClassifyBlock;
// A text in a box of a chosen size (Insert → Text box, drawn on the page): the text wraps inside it and can
// sit at the top, middle or bottom. The box grows when the text needs more room. Whole-box formatting:
// `font`, `align`; words and paragraphs are formatted in `content` (typed in the Tiptap editor on the page).
export interface TextboxBlock extends BlockBase {
  type: "textbox";
  content?: JSONContent; // Tiptap document (textboxDoc.ts); missing in older files: made from `text`
  text: string; // the same text as styled runs (kept up to date from `content`)
  align?: ParagraphAlign; // missing = along the writing direction
  valign?: "top" | "middle" | "bottom"; // missing = top
  background?: string; // fill color of the box, printed (missing = none)
  border?: string; // color of a line around the box, printed (missing = none)
  padding?: number; // room between the box's edge and its text, px (missing = TEXTBOX_PAD)
}

export type Block = QuestionBlock | TextBlock | TextboxBlock | EquationBlock | ImageBlock | TableBlock | GraphBlock | HeaderBlock;
export type BlockType = Block["type"];

// The editable fields of any one block type, all optional (used for changes and presets).
export type BlockData = {
  [B in Block as B["type"]]: Partial<Omit<B, "id" | "layout" | "type">>;
}[BlockType];

export interface ExamMeta {
  title: string;
  lang: Lang;
  templateId: string;
  // Missing in files from older versions: the defaults are used.
  fontFamily?: string; // default font of the paper
  fontSize?: number; // default size of question text (14)
  hidePoints?: boolean; // don't print "(2 pts)" next to the questions
  fullMark?: number; // full mark when there is no exam header (20)
  answerColor?: string; // correction sheet: color of the answers
  answerSize?: number; // correction sheet: size of the written answers
  chrome?: ChromeRule; // missing in older files
}

// The whole exam, as saved to disk.
export interface ExamDoc {
  version: 1;
  meta: ExamMeta;
  pages: Page[];
  blocks: Block[];
  // Header and footer of every page without its own (Page.header / Page.footer). Missing in older
  // files: `meta.chrome` (the onboarding rule) is used instead, see pageChrome.ts.
  globalHeader?: HeaderFooterConfig;
  globalFooter?: HeaderFooterConfig;
}

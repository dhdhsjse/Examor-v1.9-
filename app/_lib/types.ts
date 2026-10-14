// One A4 sheet of the exam.
export interface Page {
  id: string;
}

// Where a block sits (in page pixels, relative to its own page).
export interface BlockLayout {
  pageId: string;
  x: number;
  y: number;
  width: number;
}

// Multiple-choice question, stored as data (not just drawn shapes)
// so the correction sheet can be generated from it later.
export interface McqQuestion {
  id: string;
  type: "mcq";
  text: string;
  options: string[];
  correctAnswer: number; // index into `options`
  layout: BlockLayout;
}

// More question types (true/false, fill-in-the-blank...) will join this union.
export type Question = McqQuestion;

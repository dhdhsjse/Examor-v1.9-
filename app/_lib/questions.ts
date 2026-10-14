import { CONTENT_WIDTH, PAGE_MARGIN } from "./a4";
import { newId } from "./id";
import type { McqQuestion, Page, Question } from "./types";

// Sizes used to draw an MCQ block (shared by the canvas and the layout logic).
export const MCQ_STYLE = {
  padding: 14,
  titleHeight: 24,
  gap: 10,
  optionHeight: 28,
};

// Height of an MCQ block, based on how many options it has.
export function mcqHeight(q: McqQuestion): number {
  const s = MCQ_STYLE;
  return s.padding * 2 + s.titleHeight + s.gap + q.options.length * s.optionHeight;
}

// Create a new MCQ on a page at the given y position.
export function createMcq(pageId: string, y: number): McqQuestion {
  return {
    id: newId(),
    type: "mcq",
    text: "Type your question here...",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: 0,
    layout: { pageId, x: PAGE_MARGIN, y, width: CONTENT_WIDTH },
  };
}

// Y position just below the lowest block, so new blocks stack neatly.
export function nextFreeY(questions: Question[]): number {
  const gap = 16;
  return questions.reduce(
    (bottom, q) => Math.max(bottom, q.layout.y + mcqHeight(q) + gap),
    PAGE_MARGIN,
  );
}

// Question numbers in reading order: page by page, top to bottom.
export function questionNumbers(questions: Question[], pages: Page[]): Map<string, number> {
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));
  const sorted = [...questions].sort(
    (a, b) =>
      (pageIndex.get(a.layout.pageId) ?? 0) - (pageIndex.get(b.layout.pageId) ?? 0) ||
      a.layout.y - b.layout.y,
  );
  return new Map(sorted.map((q, i) => [q.id, i + 1]));
}

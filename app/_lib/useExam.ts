"use client";

import { useCallback, useState } from "react";
import { PAGE_HEIGHT, PAGE_MARGIN } from "./a4";
import { newId } from "./id";
import { createMcq, mcqHeight, nextFreeY } from "./questions";
import type { Page, Question } from "./types";

// Ask the workspace to scroll to a page (n changes on every request).
export interface RevealRequest {
  pageId: string;
  n: number;
}

// Holds the pages and questions of the exam and the actions that change them.
export function useExam() {
  const [pages, setPages] = useState<Page[]>(() => [{ id: newId() }]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0); // page currently in view
  const [reveal, setReveal] = useState<RevealRequest | null>(null);

  const revealPage = (pageId: string) => setReveal((r) => ({ pageId, n: (r?.n ?? 0) + 1 }));

  // Add an empty A4 page at the end.
  const addPage = useCallback(() => {
    const page = { id: newId() };
    setPages((prev) => [...prev, page]);
    revealPage(page.id);
  }, []);

  // Add an MCQ on the page in view, below its last block.
  // If that page is full, use the next page with room, or create a new one.
  const addMcq = useCallback(() => {
    const draft = createMcq("", 0);
    const bottomLimit = PAGE_HEIGHT - PAGE_MARGIN - mcqHeight(draft);
    let target: { pageId: string; y: number } | null = null;

    for (let i = Math.min(activePage, pages.length - 1); i < pages.length && !target; i++) {
      const y = nextFreeY(questions.filter((q) => q.layout.pageId === pages[i].id));
      if (y <= bottomLimit) target = { pageId: pages[i].id, y };
    }
    if (!target) {
      const page = { id: newId() };
      setPages([...pages, page]);
      target = { pageId: page.id, y: PAGE_MARGIN };
    }

    draft.layout = { ...draft.layout, ...target };
    setQuestions([...questions, draft]);
    setSelectedId(draft.id);
    revealPage(target.pageId);
  }, [activePage, pages, questions]);

  // Save a block's new page and position after it was dragged.
  const moveBlock = useCallback((id: string, pageId: string, x: number, y: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, layout: { ...q.layout, pageId, x, y } } : q)),
    );
  }, []);

  return {
    pages,
    questions,
    selectedId,
    setSelectedId,
    activePage,
    setActivePage,
    reveal,
    addPage,
    addMcq,
    moveBlock,
  };
}

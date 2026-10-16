import type { PageScope } from "../types";

// Zero-based indexes of the pages a scope covers.
export function scopePages(scope: PageScope, pageCount: number): number[] {
  switch (scope.mode) {
    case "all":
      return Array.from({ length: pageCount }, (_, i) => i);
    case "first":
      return pageCount > 0 ? [0] : [];
    case "none":
      return [];
    case "pages":
      return [...new Set(scope.pages)].map((n) => n - 1).filter((i) => i >= 0 && i < pageCount).sort((a, b) => a - b);
  }
}

// "1, 3-4" → [1, 3, 4]. Anything that is not a number or a range is ignored.
export function parsePageList(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[,;\s]+/)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && n <= 200; n++) if (n >= 1) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

export const formatPageList = (pages: number[]) => pages.join(", ");

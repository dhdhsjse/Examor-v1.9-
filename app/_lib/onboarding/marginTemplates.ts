import type { MarginTemplate } from "../onboardingTypes";

export const marginTemplates: MarginTemplate[] = [
  // Page pixels (96 DPI): 76px = 20 mm, 113px = 30 mm, 38px = 10 mm.
  { id: "margin.standard", nameKey: "Standard", margins: { top: 76, right: 76, bottom: 76, left: 76 }, recommended: true },
  { id: "margin.wide", nameKey: "Wide", margins: { top: 113, right: 113, bottom: 113, left: 113 } },
  { id: "margin.compact", nameKey: "Compact", margins: { top: 38, right: 38, bottom: 38, left: 38 } },
  { id: "margin.binding", nameKey: "Binding (stapled)", margins: { top: 76, right: 76, bottom: 76, left: 113 } },
  // Wider on the right: the binding side of an Arabic page is on the left, so this one mirrors it.
  { id: "margin.arabic", nameKey: "Arabic paper", margins: { top: 76, right: 113, bottom: 76, left: 76 } },
];

export const defaultMarginId = "margin.standard";

export const marginById = (id: string) => marginTemplates.find((m) => m.id === id) ?? marginTemplates[0];

// The preset whose numbers equal `m` (the first one wins), or undefined.
export const marginMatching = (m: { top: number; right: number; bottom: number; left: number }) =>
  marginTemplates.find((t) => t.margins.top === m.top && t.margins.right === m.right && t.margins.bottom === m.bottom && t.margins.left === m.left);

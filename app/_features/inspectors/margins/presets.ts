import { DEFAULT_MARGINS } from "@/app/_lib/a4";
import type { PageMargins } from "@/app/_lib/types";

export type MarginPreset = { id: string; nameKey: string; margins: PageMargins };

// The starting points of Page layout → Margins, in page pixels. `nameKey` is the English text (translated).
export const MARGIN_PRESETS: MarginPreset[] = [
  { id: "standard", nameKey: "Standard", margins: DEFAULT_MARGINS }, // 13 mm
  { id: "narrow", nameKey: "Narrow", margins: { top: 38, right: 38, bottom: 38, left: 38 } }, // 10 mm
  { id: "wide", nameKey: "Wide", margins: { top: 80, right: 80, bottom: 80, left: 80 } }, // 21 mm
  { id: "binding", nameKey: "Binding", margins: { top: 48, right: 48, bottom: 48, left: 96 } }, // 25 mm on the stapled side
];

import type { FigureValue, Lang } from "../types";

export type Params = Record<string, FigureValue>;

// One setting of a figure, shown as a control in Properties. `label` is an English key (translated).
// Settings with the same `row` sit side by side. `when` hides a setting that doesn't apply.
// `vars` fills "{name}" in the label from the current settings (e.g. "Angle {name}" → "Angle P").
type Base = { key: string; label: string; row?: string; when?: (p: Params) => boolean; vars?: (p: Params) => Record<string, string> };

export type FigureParam =
  | (Base & { kind: "number"; min: number; max: number; step?: number; unit?: string })
  | (Base & { kind: "text"; placeholder?: string })
  | (Base & { kind: "bool" })
  | (Base & { kind: "select"; options: { value: string; label: string }[] })
  | (Base & { kind: "color" });

// A library figure drawn from its settings.
export interface FigureDef {
  id: string;
  name: string; // English key
  hint?: string; // English key: one line shown above the settings
  params: FigureParam[];
  defaults: (lang: Lang) => Params;
  // Fix the settings that depend on the one just changed (the 3 angles of a triangle make 180°…).
  normalize?: (p: Params, changed: string) => Params;
  build: (p: Params, lang: Lang) => string; // the svg
}

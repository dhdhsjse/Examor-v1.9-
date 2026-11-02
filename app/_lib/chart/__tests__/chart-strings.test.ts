import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AR, FR } from "../../uiStrings";
import { FAMILIES } from "../catalog";
import { CHART_AR, CHART_FR } from "../strings";

const T_CALL = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;

describe("the interface strings of the Chart Studio", () => {
  const dir = join(__dirname, "../../../_components/chart-studio");
  const files = [...readdirSync(dir).map((f) => join(dir, f)), join(__dirname, "../../../_components/inspector/ContentEditors.tsx"), join(__dirname, "../../../_features/tools/tool-chart-studio.tsx")];
  const used = new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(T_CALL)].map((m) => m[1].replace(/\\"/g, '"'))));
  // (the names of the kinds and of the palettes are looked up by the Studio, not written as t("…"))
  for (const f of FAMILIES) {
    used.add(f.label);
    for (const v of f.variants) used.add(v.label);
  }
  for (const k of ["Colorful", "Blue", "Green", "Orange", "Purple", "Red", "Gray (for black and white)", "Pastel"]) used.add(k);

  it("finds the strings of the screens", () => {
    expect(used.size).toBeGreaterThan(250);
  });

  it("has a French and an Arabic text for every one", () => {
    expect([...used].filter((k) => !FR[k])).toEqual([]);
    expect([...used].filter((k) => !AR[k])).toEqual([]);
  });

  it("carries the same texts in both languages, and none that the screens do not use", () => {
    expect(Object.keys(CHART_AR).sort()).toEqual(Object.keys(CHART_FR).sort());
    expect(Object.keys(CHART_FR).filter((k) => !used.has(k))).toEqual([]);
  });

  it("names every kind and variant in French the way French statistics do", () => {
    expect(FR["Column"]).toBe("Colonnes");
    expect(FR["Histogram"]).toBe("Histogramme");
    expect(FR["Box & Whisker"]).toBe("Boîte à moustaches");
  });
});

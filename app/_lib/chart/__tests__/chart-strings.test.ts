import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AR, FR } from "../../uiStrings";

const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;

describe("the interface strings of the Chart Studio", () => {
  const dir = join(__dirname, "../../../_components/chart-studio");
  const files = [...readdirSync(dir).map((f) => join(dir, f)), join(__dirname, "../../../_features/tools/tool-chart-studio.tsx")];
  const used = new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(T_CALL)].map((m) => m[1])));
  // (the names of the kinds are written as data, then translated)
  for (const k of ["Bar chart", "Horizontal bars", "Sticks", "Histogram", "Line chart", "Area chart", "Pie", "Half pie"]) used.add(k);

  it("finds the strings of the Studio", () => {
    expect(used.has("Chart Studio")).toBe(true);
    expect(used.size).toBeGreaterThan(20);
  });

  it("has a French text and an Arabic text for each", () => {
    expect([...used].filter((k) => !(k in FR))).toEqual([]);
    expect([...used].filter((k) => !(k in AR))).toEqual([]);
  });
});

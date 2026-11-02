import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MATHGRAPH_AR, MATHGRAPH_FR } from "../mathGraphStrings";
import { AR, FR } from "../uiStrings";

const T_CALL = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;

describe("the interface strings of the Function Studio", () => {
  const dir = join(__dirname, "../../_components/math-graph-studio");
  const files = [...readdirSync(dir).map((f) => join(dir, f)), join(__dirname, "../../_components/inspector/GraphEditor.tsx")];
  const used = new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(T_CALL)].map((m) => m[1])));

  it("finds the strings of the screens", () => {
    expect(used.size).toBeGreaterThan(25);
  });

  it("has a French and an Arabic text for every one", () => {
    expect([...used].filter((k) => !FR[k])).toEqual([]);
    expect([...used].filter((k) => !AR[k])).toEqual([]);
  });

  it("does not carry a text the screens do not use", () => {
    expect(Object.keys(MATHGRAPH_FR).filter((k) => !used.has(k))).toEqual([]);
    expect(Object.keys(MATHGRAPH_AR)).toEqual(Object.keys(MATHGRAPH_FR));
  });
});

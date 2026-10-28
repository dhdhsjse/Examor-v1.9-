import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AR, FR } from "../uiStrings";
import { TABLE_AR, TABLE_FR } from "../table/strings";

const T_CALL = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;

describe("the interface strings of the Table Studio and the table panel", () => {
  const dirs = ["../../_components/table", "../../_components/table-studio"].map((d) => join(__dirname, d));
  const files = [...dirs.flatMap((d) => readdirSync(d).map((f) => join(d, f))), join(__dirname, "../../_features/tools/tool-table-studio.tsx")];
  const used = new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(T_CALL)].map((m) => m[1])));
  // (the names the start buttons, the border styles and the list of borders are looked up by)
  for (const k of ["Grid", "Box", "Rows", "Columns", "None", "All borders", "Outside borders", "Inside borders", "Top border", "Bottom border", "Left border", "Right border", "No borders"]) used.add(k);

  it("finds the strings of the screens", () => {
    expect(used.size).toBeGreaterThan(40);
  });

  it("has a French and an Arabic text for every one", () => {
    expect([...used].filter((k) => !FR[k])).toEqual([]);
    expect([...used].filter((k) => !AR[k])).toEqual([]);
  });

  it("keeps the {placeholders} of the English text", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const dict of [TABLE_FR, TABLE_AR]) for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
  });
});

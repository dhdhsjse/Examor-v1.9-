import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAPH_AR, GRAPH_FR } from "../../graph/strings";
import { STUDIO_AR, STUDIO_FR } from "../../chemistry/strings";
import { MOLECULE_AR, MOLECULE_FR } from "../../../_molecule/strings";
import { SHAPES_AR, SHAPES_FR } from "../../shapes/strings";
import { CIRCUIT_AR, CIRCUIT_FR } from "../strings";
import { COMPONENT_SPECS, COMPONENT_TYPES } from "../symbols";

const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;
// the help lines of the toolbar are looked up by tool, so they are read from the file as quoted strings that start a record entry
const HINT_LINE = /^\s+\w+: "((?:[^"\\]|\\.)*)",$/gm;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the interface strings of the Circuit Studio", () => {
  const dir = join(__dirname, "../../../_components/circuit-studio");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(dir, f), "utf8"));
  sources.push(readFileSync(join(__dirname, "../../../_features/tools/tool-circuit-studio.tsx"), "utf8"));
  const toolbar = readFileSync(join(dir, "CircuitToolbar.tsx"), "utf8");
  const hints = [...toolbar.slice(toolbar.indexOf("const TOOL_HINTS"), toolbar.indexOf("export { TOOL_HINTS }")).matchAll(HINT_LINE)].map((m) => m[1]);
  const used = new Set([...sources.flatMap((src) => [...src.matchAll(T_CALL)].map((m) => m[1])), ...hints, ...COMPONENT_TYPES.map((t) => COMPONENT_SPECS[t].name)]);
  const app = readFileSync(join(__dirname, "../../uiStrings.ts"), "utf8");

  it("finds the strings of the screens, the hints and the component names", () => {
    expect(used.size).toBeGreaterThan(30);
    expect(hints.length).toBe(12); // one per tool
    expect(used.has("Resistor")).toBe(true);
  });

  it("has a French text and an Arabic text for each, here or elsewhere in the app", () => {
    const known = (dicts: Record<string, string>[], k: string) => dicts.some((d) => k in d) || app.includes(`"${k}":`);
    expect([...used].filter((k) => !known([CIRCUIT_FR, GRAPH_FR, STUDIO_FR, MOLECULE_FR, SHAPES_FR], k))).toEqual([]);
    expect([...used].filter((k) => !known([CIRCUIT_AR, GRAPH_AR, STUDIO_AR, MOLECULE_AR, SHAPES_AR], k))).toEqual([]);
  });

  it("keeps the {placeholders} of the English text", () => {
    for (const dict of [CIRCUIT_FR, CIRCUIT_AR]) for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
  });
});

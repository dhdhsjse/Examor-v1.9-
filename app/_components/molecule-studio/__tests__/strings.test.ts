import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STUDIO_AR, STUDIO_FR, TOOL_HINTS } from "../../../_lib/chemistry/strings";
import { MOLECULE_AR, MOLECULE_FR } from "../../../_molecule/strings";

const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;
const PLACEHOLDER = /\{(\w+)\}/g;
const placeholders = (s: string) => [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

// Every t("...") of the drawing Studio needs a French and an Arabic text, here or elsewhere in the app.
describe("drawing Studio strings", () => {
  const dir = join(__dirname, "..");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(dir, f), "utf8"));
  sources.push(readFileSync(join(__dirname, "../../../_features/tools/tool-molecule-lab.tsx"), "utf8"));
  const used = new Set(sources.flatMap((src) => [...src.matchAll(T_CALL)].map((m) => m[1])));
  const app = readFileSync(join(__dirname, "../../../_lib/uiStrings.ts"), "utf8");

  it("finds the strings of the screens", () => {
    expect(used.size).toBeGreaterThan(10);
  });

  it("has a French text for every string", () => {
    expect([...used].filter((k) => !(k in STUDIO_FR) && !(k in MOLECULE_FR) && !app.includes(`"${k}":`))).toEqual([]);
  });

  it("has an Arabic text for every string", () => {
    expect([...used].filter((k) => !(k in STUDIO_AR) && !(k in MOLECULE_AR) && !app.includes(`"${k}":`))).toEqual([]);
  });

  it("keeps the {placeholders} of the English text in both translations", () => {
    for (const dict of [STUDIO_FR, STUDIO_AR]) {
      for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
    }
  });

  it("translates the help line of every tool (they are looked up by tool name)", () => {
    expect(Object.keys(TOOL_HINTS).sort()).toEqual(["arrow", "atom", "bond", "electron", "erase", "pair", "ring", "select", "template", "text"]);
    for (const hint of Object.values(TOOL_HINTS)) {
      expect(STUDIO_FR[hint], `${hint} (fr)`).toBeTruthy();
      expect(STUDIO_AR[hint], `${hint} (ar)`).toBeTruthy();
    }
  });

  it("translates the names used by the toolbar (bonds, rings, groups, annotations)", () => {
    for (const key of ["Bonds", "Single", "Double", "Triple", "Single bond", "Double bond", "Triple bond", "Rings", "Functional groups", "Annotations", "Cyclohexane", "Benzene", "Cyclopentane", "Hydroxyl group", "Carboxyl group", "Amino group", "Aldehyde group", "Methyl group", "Arrow"]) {
      expect(STUDIO_FR[key], `${key} (fr)`).toBeTruthy();
      expect(STUDIO_AR[key], `${key} (ar)`).toBeTruthy();
    }
  });
});

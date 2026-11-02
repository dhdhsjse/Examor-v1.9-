import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AR, FR } from "../../uiStrings";
import { PLACE_NAMES } from "../../../_components/proba-studio/ProbaToolbar";
import { PROBA_AR, PROBA_FR } from "../strings";
import { PROBA_COLORS } from "../types";

const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the interface strings of the Probability Studio", () => {
  const dir = join(__dirname, "../../../_components/proba-studio");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(dir, f), "utf8"));
  sources.push(readFileSync(join(__dirname, "../../../_features/tools/tool-proba-studio.tsx"), "utf8"));
  const used = new Set([...sources.flatMap((src) => [...src.matchAll(T_CALL)].map((m) => m[1])), ...Object.values(PLACE_NAMES), ...PROBA_COLORS.map((c) => c.name)]);

  it("finds the strings of the screens, the figures and the colors", () => {
    expect(used.size).toBeGreaterThan(60);
    expect(used.has("Probability tree")).toBe(true);
    expect(used.has("Yellow")).toBe(true);
  });

  it("has a French text and an Arabic text for each, here or elsewhere in the app", () => {
    expect([...used].filter((k) => !(k in FR))).toEqual([]);
    expect([...used].filter((k) => !(k in AR))).toEqual([]);
  });

  it("keeps the {placeholders} of the English text", () => {
    for (const dict of [PROBA_FR, PROBA_AR]) for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
  });
});

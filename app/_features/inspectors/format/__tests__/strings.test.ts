import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RIBBON_AR, RIBBON_FR } from "@/app/_lib/ribbon/strings";
import { SYMBOL_GROUPS } from "@/app/_lib/symbols";
import { AR, FR } from "@/app/_lib/uiStrings";

const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;
const LABEL = /\blabel: "((?:[^"\\]|\\.)*)"/g; // (menus keep their English texts in lists and translate them when drawn)
const NAMES = /BULLET_NAMES[^=]*=\s*\{([^}]*)\}/;
const PLACEHOLDER = /\{(\w+)\}/g;
const placeholders = (s: string) => [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

const root = join(__dirname, "../../../..");
const files = [
  ...readdirSync(join(__dirname, ".."))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join(__dirname, "..", f)),
  join(root, "_features/inspectors/home/FormattingInspector.tsx"),
  join(root, "_features/inspectors/home/FindReplaceInspector.tsx"),
  join(root, "_features/inspectors/home/SymbolsInspector.tsx"),
  join(root, "_features/inspectors/textbox/TextboxInspector.tsx"),
  join(root, "_components/rich/FormatBar.tsx"),
];

// The English texts the ribbon shows.
const used = new Set<string>();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(T_CALL)) used.add(m[1]);
  for (const m of src.matchAll(LABEL)) used.add(m[1]);
  const names = NAMES.exec(src);
  if (names) for (const m of names[1].matchAll(/:\s*"([^"]+)"/g)) used.add(m[1]);
}
// (a label that is only a sample of a numbering style or a size is not text)
const texts = [...used].filter((k) => /[a-zA-Z]{3}/.test(k));

describe("the ribbon strings", () => {
  it("finds the texts of the screens", () => {
    expect(texts.length).toBeGreaterThan(60);
    expect(texts).toContain("Change case");
    expect(texts).toContain("Bottom border"); // (from a list of labels)
    expect(texts).toContain("Check mark"); // (from the bullet names)
  });

  it("has a French text for every string", () => {
    expect(texts.filter((k) => !(k in FR))).toEqual([]);
  });

  it("has an Arabic text for every string", () => {
    expect(texts.filter((k) => !(k in AR))).toEqual([]);
  });

  it("has a name in French and in Arabic for every group of symbols (they are translated when drawn)", () => {
    expect(SYMBOL_GROUPS.map((g) => g.name).filter((k) => !(k in FR) || !(k in AR))).toEqual([]);
  });

  it("keeps the {placeholders} of the English text in both translations", () => {
    for (const dict of [RIBBON_FR, RIBBON_AR]) {
      for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
    }
  });

  it("does not translate a word the app already had in a different way", () => {
    // (the ribbon file only adds new texts: a key repeated in the main dictionary would be changed by the merge)
    const main = readFileSync(join(root, "_lib/uiStrings.ts"), "utf8").split("Object.assign(FR, MOLECULE_FR)")[0];
    expect(Object.keys(RIBBON_FR).filter((k) => main.includes(`\n  "${k}":`))).toEqual([]);
  });
});

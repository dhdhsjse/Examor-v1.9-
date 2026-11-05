import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AR, FR } from "../uiStrings";
import { SHEET_AR, SHEET_FR } from "../sheet/strings";

const B = String.fromCharCode(92);

// Every t("…") of a file: the English text of what is shown
function textsOf(file: string): string[] {
  const s = readFileSync(join(__dirname, file), "utf8");
  const out: string[] = [];
  let i = 0;
  while ((i = s.indexOf('t("', i)) >= 0) {
    const prev = s[i - 1] ?? " ";
    i += 3;
    if (/[A-Za-z0-9_$]/.test(prev)) continue;
    let text = "";
    while (i < s.length && s[i] !== '"') {
      if (s[i] === B) {
        text += s[i + 1];
        i += 2;
      } else text += s[i++];
    }
    out.push(text);
  }
  return out;
}

describe("the interface strings of the correction sheet", () => {
  // (looked up by name: the checks and the prompt of the print preview, the messages of the editor, the button of the exam's settings, the answer bar: their
  // files have many other texts)
  const elsewhere = [
    "The correction sheet has no marks yet",
    "Correction sheet: {total} = graded out of {outOf}",
    "The correction sheet adds up to {total} pts, the exam is out of {outOf}",
    "Change the marks of the stickers, or the full mark of the exam.",
    "{n} question(s) have other marks in the correction sheet than the points in the exam",
    "Open the correction sheet: its settings show which, and how to make them agree.",
    "{n} question(s) of the exam are not in the correction sheet",
    "{n} block(s) of the correction sheet changed in the exam since it was made",
    "Open the correction sheet: its settings bring them up to date.",
    "There is no correction sheet yet",
    "Make it first: it is printed here, with the marks beside the answers.",
    "Correction sheet made",
    "Correction sheet made from the exam — check it and move what you want",
    "Make the correction sheet first",
    "Open the correction sheet",
    "This row already has a total.",
    "Make the correction sheet…",
    "Model answer: Properties panel",
  ];
  const files = [
    "../../_components/workspace/StickerPanel.tsx",
    "../../_components/inspector/SheetEditors.tsx",
    "../../_components/inspector/SheetSettings.tsx",
    "../../_components/sheet/SheetWizard.tsx",
    "../../_features/panels/exam-summary.tsx",
    "../../_features/groups/group-stickers.ts",
  ];
  // (looked up by name: the lines a sticker panel offers, and the message of the Stamp tool)
  const used = new Set([...files.flatMap(textsOf), ...elsewhere, "Line between rows", "Line between exercises", "Invisible break", "Click on the page to put the sticker — Esc to stop"]);

  it("finds the strings of the screens", () => {
    expect(used.size).toBeGreaterThan(100);
  });

  it("has a French and an Arabic text for every one", () => {
    expect([...used].filter((k) => !FR[k])).toEqual([]);
    expect([...used].filter((k) => !AR[k])).toEqual([]);
  });

  it("keeps the {placeholders} of the English text", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const dict of [SHEET_FR, SHEET_AR]) for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
  });

  it("translates nothing that is not shown, and nothing the app already says", () => {
    expect(Object.keys(SHEET_FR).sort()).toEqual(Object.keys(SHEET_AR).sort());
    for (const k of Object.keys(SHEET_FR)) expect(used.has(k), k).toBe(true);
  });
});

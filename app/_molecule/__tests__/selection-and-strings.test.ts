import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formula } from "../chem";
import { applyVisibility, hasVisibilityEdits, removeSelected } from "../edit/selectionOps";
import { emptySelection } from "../edit/select";
import { FAMILIES } from "../families";
import { MOLECULE_AR, MOLECULE_FR, REP_CAPTION, REP_LABEL, REP_SHORT, SHORTCUTS, TAB_TEXT, WELCOME_FEATURES } from "../strings";
import { availableRepresentations, renderMolecule } from "../render";
import { blockFor } from "./helpers";

describe("what the buttons do to the selection", () => {
  it("hides atoms, bonds and lone pairs together; blank leaves lone pairs shown-or-hidden only", async () => {
    const b = await blockFor("CC(=O)O", "lewis");
    const o3 = b.graph.atoms[2].id;
    const sel = { atoms: [b.graph.atoms[0].id], bonds: [b.graph.bonds[0].id], lonePairs: [`${o3}:1`] };
    const hidden = applyVisibility(b, sel, "hidden");
    expect(hidden.edits.atoms[sel.atoms[0]].vis).toBe("hidden");
    expect(hidden.edits.bonds[sel.bonds[0]].vis).toBe("hidden");
    expect(hidden.edits.lonePairs[o3]).toEqual([true, false]);
    const shown = applyVisibility(hidden, sel, "shown");
    expect(hasVisibilityEdits(shown.edits)).toBe(false);
    expect(applyVisibility(b, { ...emptySelection(), lonePairs: [`${o3}:0`] }, "blank").edits.lonePairs[o3]).toEqual([false, true]);
  });

  it("removes the selected bonds and atoms (with their hydrogens)", async () => {
    const b = await blockFor("CC(=O)O");
    const out = removeSelected(b, { ...emptySelection(), atoms: [b.graph.atoms[3].id] });
    expect(formula(out.graph)).toBe("C2H3O");
    expect(removeSelected(b, emptySelection())).toBe(b);
  });

  it("knows whether the student version differs from the answer key", async () => {
    const b = await blockFor("CC(=O)O");
    expect(hasVisibilityEdits(b.edits)).toBe(false);
    expect(hasVisibilityEdits({ ...b.edits, hideAllHydrogens: true })).toBe(true);
    expect(hasVisibilityEdits({ ...b.edits, atoms: { x: { x: 1, y: 2 } } })).toBe(false); // a move alone is not a hidden part
    expect(hasVisibilityEdits({ ...b.edits, atoms: { x: { label: "" } } })).toBe(true);
  });
});

describe("the reference exercise, from one molecule", () => {
  it("given figure with stubs (student) and its answer key (answer), same data", async () => {
    const base = await blockFor("CC(=O)O");
    const [c1, c2, o3, o4] = base.graph.atoms;
    // Figure of the exercise: two carbons and one O visible; the other O and every hydrogen left out as stubs.
    const edits = { ...base.edits, hideAllHydrogens: true, atoms: { [o4.id]: { vis: "hidden" as const }, [o3.id]: { vis: "blank" as const } } };
    const student = renderMolecule({ ...base, exerciseMode: "student", edits }).svg;
    const answer = renderMolecule({ ...base, exerciseMode: "answer", edits }).svg;
    expect(answer).toBe(renderMolecule(base).svg); // the key ignores every hiding edit
    expect(student).not.toBe(answer);
    const labels = (svg: string) => [...svg.matchAll(/data-atom-id="([^"]+)"/g)].map((m) => m[1]);
    expect(labels(answer)).toHaveLength(8);
    expect(labels(student).sort()).toEqual([c1.id, c2.id, o3.id].sort()); // C, C and the blank box: everything else is a stub
    expect((student.match(/data-bond-id/g) ?? []).length).toBe(6); // the bonds stay as stubs where an atom is gone; O–H, with both ends gone, leaves nothing
  });
});

describe("translations of the Studio", () => {
  it("every string used by the Studio components has a French and an Arabic translation", () => {
    const dir = join(process.cwd(), "app/_components/molecule");
    const used = new Set<string>();
    const walk = (d: string) => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(join(d, f.name));
        else if (f.name.endsWith(".tsx")) for (const m of readFileSync(join(d, f.name), "utf8").matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) used.add(m[1]);
      }
    };
    walk(dir);
    // texts that live in constant lists and are translated when shown
    for (const v of [...Object.values(REP_LABEL), ...Object.values(REP_SHORT), ...Object.values(REP_CAPTION), ...FAMILIES.map((f) => f.label), ...SHORTCUTS.map((s) => s[1])]) used.add(v);
    for (const x of Object.values(TAB_TEXT)) [x.label, x.hint].forEach((v) => used.add(v));
    for (const f of WELCOME_FEATURES) [f.title, f.text].forEach((v) => used.add(v));
    const app = readFileSync(join(process.cwd(), "app/_lib/uiStrings.ts"), "utf8");
    const missing = [...used].filter((k) => !(k in MOLECULE_FR) && !app.includes(`"${k}":`));
    const missingAr = [...used].filter((k) => !(k in MOLECULE_AR) && !app.includes(`"${k}":`));
    expect(missing).toEqual([]);
    expect(missingAr).toEqual([]);
  });

  it("every tab that exists has a French and an Arabic name", () => {
    for (const rep of availableRepresentations()) {
      expect(MOLECULE_FR[REP_LABEL[rep]], `${rep} (fr)`).toBeTruthy();
      expect(MOLECULE_AR[REP_LABEL[rep]], `${rep} (ar)`).toBeTruthy();
    }
  });

  it("French and Arabic keep the {placeholders} of the English text", () => {
    for (const dict of [MOLECULE_FR, MOLECULE_AR]) {
      for (const [en, tr] of Object.entries(dict)) {
        const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(holes(tr), en).toEqual(holes(en));
      }
    }
  });
});

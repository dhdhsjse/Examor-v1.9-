"use client";

import { useT } from "@/app/_lib/uiLang";
import { displayFormula } from "@/app/_molecule/chem";
import { defaultRenderOptions, type MoleculeBlockData, type SemiStyle } from "@/app/_molecule/model";
import { FIXED_LAYOUT } from "../layoutRules";
import type { MoleculeEditor } from "../useMoleculeEditor";
import { Formula, Group, Seg } from "../ui";

interface Props {
  block: MoleculeBlockData;
  editor: MoleculeEditor;
  name: string | null; // what to call the molecule (a name from the database, or what was typed)
}

// How the drawing looks. Only the choices that apply to the current representation are shown.
export default function DisplayTab({ block, editor, name }: Props) {
  const t = useT();
  const o = block.options;
  const rep = block.representation;
  const fixed = FIXED_LAYOUT.includes(rep);
  const lone = rep === "lewis" || rep === "cram";
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-subtle px-3.5 py-3">
        {name && <p className="text-sm font-semibold text-ink">{name}</p>}
        <p className="text-xs text-muted">
          <Formula text={displayFormula(block.graph)} /> · {t("{n} atoms", { n: block.graph.atoms.length })}
        </p>
      </div>

      <Group title={t("Size")} hint={t("How big the drawing is on the page.")}>
        <input
          type="range"
          min={30}
          max={80}
          value={o.bondLength}
          aria-label={t("Size")}
          onChange={(e) => {
            const bondLength = Number(e.target.value);
            editor.setOptions({ bondLength, fontSize: Math.round(bondLength * (defaultRenderOptions().fontSize / defaultRenderOptions().bondLength)) });
          }}
          className="accent-indigo-600"
        />
        <div className="flex justify-between text-[11px] text-faint">
          <span>{t("Small")}</span>
          <span>{t("Large")}</span>
        </div>
      </Group>

      {!fixed && (
        <Group title={t("How the atoms are arranged")} hint={t("School: bonds at right angles, like in the textbook. Automatic: like a chemistry program.")}>
          <Seg
            value={o.layout}
            onChange={(layout) => editor.setOptions({ layout })}
            options={[
              { value: "school", label: t("School layout") },
              { value: "auto", label: t("Automatic layout") },
            ]}
          />
        </Group>
      )}

      {rep !== "skeletal" && rep !== "molecular" && rep !== "semi-structural" && (
        <Group title={t("Hydrogens")} hint={t("Which hydrogen atoms are drawn.")}>
          <Seg
            vertical
            value={o.showHydrogens}
            onChange={(showHydrogens) => editor.setOptions({ showHydrogens })}
            options={[
              { value: "all", label: t("All hydrogens") },
              { value: "hetero-and-terminal", label: t("Only on O, N… and chain ends") },
              { value: "none", label: t("None") },
            ]}
          />
        </Group>
      )}

      {rep === "semi-structural" && (
        <Group title={t("How much to group")} hint={t("Condensed: CH3COOH. Semi-developed: CH3–COOH. Expanded: CH3–C(=O)–OH.")}>
          <Seg<SemiStyle>
            vertical
            value={o.semiStyle}
            onChange={(semiStyle) => editor.setOptions({ semiStyle })}
            options={[
              { value: "fully-condensed", label: t("Condensed") },
              { value: "semi", label: t("Semi-developed") },
              { value: "semi-expanded", label: t("Expanded") },
            ]}
          />
        </Group>
      )}

      {lone && (
        <Group title={t("Lone pairs")} hint={rep === "cram" ? t("Draw the non-bonding pairs on the Cram drawing too.") : t("How the non-bonding pairs are drawn.")}>
          {rep === "cram" && (
            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="checkbox" className="accent-indigo-600" checked={o.cramLonePairs} onChange={(e) => editor.setOptions({ cramLonePairs: e.target.checked })} />
              {t("Show the lone pairs")}
            </label>
          )}
          {(rep === "lewis" || o.cramLonePairs) && (
            <Seg
              value={o.lonePairStyle}
              onChange={(lonePairStyle) => editor.setOptions({ lonePairStyle })}
              options={[
                { value: "dots", label: t("Dots") },
                { value: "lines", label: t("Lines") },
              ]}
            />
          )}
        </Group>
      )}
    </div>
  );
}

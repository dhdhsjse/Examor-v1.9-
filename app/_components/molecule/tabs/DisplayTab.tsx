"use client";

import Disclosure from "@/app/_components/graph-studio/Disclosure";
import { Group, Row, Segmented, SelectField, SwitchRow } from "@/app/_components/graph-studio/fields";
import { useT } from "@/app/_lib/uiLang";
import type { MoleculeBlockData, SemiStyle } from "@/app/_molecule/model";
import { FIXED_LAYOUT } from "../layoutRules";
import type { MoleculeEditor } from "../useMoleculeEditor";

interface Props {
  block: MoleculeBlockData;
  editor: MoleculeEditor;
}

// How the drawing looks. Only the choices that apply to the current representation are shown.
export default function DisplayTab({ block, editor }: Props) {
  const t = useT();
  const o = block.options;
  const rep = block.representation;
  const fixed = FIXED_LAYOUT.includes(rep);
  if (rep === "molecular") return null; // (nothing to choose: it is a line of text)
  const pairStyle = (
    <Segmented
      label={t("Lone pairs")}
      value={o.lonePairStyle}
      onChange={(lonePairStyle) => editor.setOptions({ lonePairStyle })}
      attr="data-lone-pair-style"
      options={[
        { value: "dots", label: t("Dots") },
        { value: "lines", label: t("Lines") },
      ]}
    />
  );
  return (
    <Disclosure title={t("Display")} testId="molecule-display">
      <Group>
        {!fixed && rep !== "semi-structural" && (
          <SelectField
            label={t("Layout")}
            title={t("School: bonds at right angles, like in the textbook. Automatic: like a chemistry program.")}
            value={o.layout}
            onChange={(layout) => editor.setOptions({ layout: layout as typeof o.layout })}
            options={[
              { value: "school", label: t("School layout") },
              { value: "auto", label: t("Automatic layout") },
            ]}
            testId="molecule-layout"
          />
        )}
        {rep !== "skeletal" && rep !== "semi-structural" && (
          <SelectField
            stacked
            label={t("Hydrogens")}
            value={o.showHydrogens}
            onChange={(showHydrogens) => editor.setOptions({ showHydrogens: showHydrogens as typeof o.showHydrogens })}
            options={[
              { value: "all", label: t("All hydrogens") },
              { value: "hetero-and-terminal", label: t("Only on O, N… and chain ends") },
              { value: "none", label: t("None") },
            ]}
            testId="molecule-hydrogens"
          />
        )}
        {rep === "semi-structural" && (
          <SelectField
            stacked
            label={t("How much to group")}
            title={t("Condensed: CH3COOH. Semi-developed: CH3–COOH. Expanded: CH3–C(=O)–OH.")}
            value={o.semiStyle}
            onChange={(semiStyle) => editor.setOptions({ semiStyle: semiStyle as SemiStyle })}
            options={[
              { value: "fully-condensed", label: t("Condensed") },
              { value: "semi", label: t("Semi-developed") },
              { value: "semi-expanded", label: t("Expanded") },
            ]}
            testId="molecule-semi-style"
          />
        )}
        {rep === "cram" && <SwitchRow label={t("Show the lone pairs")} checked={o.cramLonePairs} onChange={(cramLonePairs) => editor.setOptions({ cramLonePairs })} testId="cram-lone-pairs" />}
        {(rep === "lewis" || (rep === "cram" && o.cramLonePairs)) && (
          <Row label={t("Lone pairs")} stacked>
            {pairStyle}
          </Row>
        )}
      </Group>
    </Disclosure>
  );
}

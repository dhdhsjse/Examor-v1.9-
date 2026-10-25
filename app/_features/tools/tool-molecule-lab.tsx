import { MoleculeIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "molecule-lab" };

// Opens the drawing Studio (periodic table, graph paper canvas). The Molecule tile next to it is the
// generator (name / formula → school representations); this one is for drawing a molecule by hand.
export const toolMoleculeLab: Feature = {
  id: "tool.chemistry.molecule-lab",
  kind: "tool",
  label: (t) => t("Draw a molecule"),
  icon: <MoleculeIcon />,
  tone: "emerald",
  tags: ["chemistry", "chimie", "draw", "dessiner", "molecule", "molécule", "periodic table", "tableau périodique", "atom", "atome", "كيمياء", "جزيء", "رسم"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};

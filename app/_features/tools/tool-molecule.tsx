import { MoleculeIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "molecule" };

// Opens the Molecule Studio; inserting from there puts a molecule on the page.
export const toolMolecule: Feature = {
  id: "tool.chemistry.molecule",
  kind: "tool",
  label: "Molecule",
  icon: <MoleculeIcon />,
  tone: "emerald",
  tags: ["chemistry", "chimie", "formula", "structure", "lewis", "molecule", "molécule", "كيمياء", "جزيء"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};

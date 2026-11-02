import { ProbabilityTreeIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "proba-studio" };

// Opens the Probability Studio: probability trees (built from their stages, with the products along the paths worked out),
// Venn diagrams, urns, dice, coins, spinners and cards, for the probability exercises of an exam.
export const toolProbaStudio: Feature = {
  id: "tool.proba-studio",
  kind: "tool",
  label: (t) => t("Probability trees"),
  icon: <ProbabilityTreeIcon />,
  tone: "indigo",
  tags: ["probability", "probabilité", "probabilités", "tree", "arbre", "arbre pondéré", "venn", "urne", "urn", "dé", "dice", "pièce", "coin", "roue", "spinner", "événement", "event", "احتمال", "احتمالات", "شجرة", "صندوق", "نرد"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};

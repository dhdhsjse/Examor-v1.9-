import { CircuitDrawIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "circuit-studio" };

// Opens the Circuit Studio (components and orthogonal wires on a grid). The "Circuit" tile next to it puts a ready-made library
// figure on the page; this one is for drawing the circuit of an exercise by hand.
export const toolCircuitStudio: Feature = {
  id: "tool.circuit-studio",
  kind: "tool",
  label: (t) => t("Draw a circuit"),
  icon: <CircuitDrawIcon />,
  tone: "emerald",
  tags: ["circuit", "électrique", "electrical", "resistor", "résistance", "battery", "pile", "capacitor", "condensateur", "wire", "fil", "schéma", "diagram", "دارة", "كهربائية", "مقاومة", "رسم"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};

import { LayoutTemplate } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";

// Opens the gallery of ready exams (blank layouts and complete examples).
export const designExamplesAction: Feature = {
  id: "action.design.examples",
  kind: "action",
  label: "Example exams…",
  icon: <LayoutTemplate size={18} strokeWidth={1.7} />,
  tags: ["template", "example", "modèle", "exemple", "نموذج"],
  run: (ctx) => ctx.shell.openPicker(),
};

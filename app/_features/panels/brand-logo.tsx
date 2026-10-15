import type { Feature } from "@/app/_features/core/types";

export const brandLogoPanel: Feature = {
  id: "panel.brand.logo",
  kind: "panel",
  label: "Exam Builder",
  render: () => <div className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-white">E</div>,
};

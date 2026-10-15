import type { Feature } from "@/app/_features/core/types";

export const fileHistoryAction: Feature = {
  id: "action.file.history",
  kind: "menu-item",
  label: "Version history…",
  order: 4,
  separatorBefore: true,
  run: (ctx) => ctx.shell.showHistory(),
};

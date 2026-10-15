import type { Feature } from "@/app/_features/core/types";

export const fileOpenAction: Feature = {
  id: "action.file.open",
  kind: "menu-item",
  label: "Open exam…",
  order: 2,
  run: (ctx) => ctx.shell.openExam(),
};

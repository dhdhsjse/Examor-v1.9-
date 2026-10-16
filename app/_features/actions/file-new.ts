import type { Feature } from "@/app/_features/core/types";

export const fileNewAction: Feature = {
  id: "action.file.new",
  kind: "menu-item",
  label: "New from template…",
  order: 1,
  run: (ctx) => ctx.shell.newExam(),
};

import type { Feature } from "@/app/_features/core/types";

export const subjectGeneral: Feature = {
  id: "action.subject.general",
  kind: "menu-item",
  label: "General",
  order: 1,
  checked: (ctx) => ctx.shell.subject === "General",
  run: (ctx) => ctx.shell.setSubject("General"),
};

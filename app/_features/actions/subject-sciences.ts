import type { Feature } from "@/app/_features/core/types";

export const subjectSciences: Feature = {
  id: "action.subject.sciences",
  kind: "menu-item",
  label: "Sciences",
  order: 4,
  checked: (ctx) => ctx.shell.subject === "Sciences",
  run: (ctx) => ctx.shell.setSubject("Sciences"),
};

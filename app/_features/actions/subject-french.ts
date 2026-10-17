import type { Feature } from "@/app/_features/core/types";

export const subjectFrench: Feature = {
  id: "action.subject.french",
  kind: "menu-item",
  label: "French",
  order: 6,
  checked: (ctx) => ctx.shell.subject === "French",
  run: (ctx) => ctx.shell.setSubject("French"),
};

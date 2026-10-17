import type { Feature } from "@/app/_features/core/types";

export const subjectMath: Feature = {
  id: "action.subject.math",
  kind: "menu-item",
  label: "Math",
  order: 2,
  checked: (ctx) => ctx.shell.subject === "Math",
  run: (ctx) => ctx.shell.setSubject("Math"),
};

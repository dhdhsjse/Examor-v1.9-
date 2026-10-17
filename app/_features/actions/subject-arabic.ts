import type { Feature } from "@/app/_features/core/types";

export const subjectArabic: Feature = {
  id: "action.subject.arabic",
  kind: "menu-item",
  label: "Arabic",
  order: 5,
  checked: (ctx) => ctx.shell.subject === "Arabic",
  run: (ctx) => ctx.shell.setSubject("Arabic"),
};

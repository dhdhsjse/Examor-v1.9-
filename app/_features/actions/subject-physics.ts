import type { Feature } from "@/app/_features/core/types";

export const subjectPhysics: Feature = {
  id: "action.subject.physics",
  kind: "menu-item",
  label: "Physics",
  order: 3,
  checked: (ctx) => ctx.shell.subject === "Physics",
  run: (ctx) => ctx.shell.setSubject("Physics"),
};

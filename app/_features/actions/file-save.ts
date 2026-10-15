import type { Feature } from "@/app/_features/core/types";

export const fileSaveAction: Feature = {
  id: "action.file.save",
  kind: "menu-item",
  label: "Save exam…",
  hotkey: "Ctrl+S",
  order: 3,
  run: (ctx) => ctx.shell.saveExam(),
};

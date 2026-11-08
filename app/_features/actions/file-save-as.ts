import type { Feature } from "@/app/_features/core/types";

export const fileSaveAsAction: Feature = {
  id: "action.file.save-as",
  kind: "menu-item",
  label: "Save as…",
  hotkey: "Ctrl+Shift+S",
  order: 3.5,
  run: (ctx) => ctx.shell.saveExamAs(),
};

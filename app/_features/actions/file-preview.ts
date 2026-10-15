import type { Feature } from "@/app/_features/core/types";

export const filePreviewAction: Feature = {
  id: "action.file.preview",
  kind: "menu-item",
  label: "Print preview & export…",
  hotkey: "Ctrl+P",
  order: 5,
  run: (ctx) => ctx.shell.showPreview(),
};

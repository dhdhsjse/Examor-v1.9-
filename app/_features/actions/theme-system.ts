import type { Feature } from "@/app/_features/core/types";

export const themeSystemAction: Feature = {
  id: "action.theme.system",
  kind: "menu-item",
  label: "Match the system",
  order: 22,
  checked: (ctx) => ctx.shell.themeMode === "system",
  run: (ctx) => ctx.shell.setThemeMode("system"),
};

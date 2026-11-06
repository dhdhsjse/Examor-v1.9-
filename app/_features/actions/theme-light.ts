import type { Feature } from "@/app/_features/core/types";

export const themeLightAction: Feature = {
  id: "action.theme.light",
  kind: "menu-item",
  label: "Light mode",
  order: 20,
  separatorBefore: true,
  heading: "Appearance",
  checked: (ctx) => ctx.shell.themeMode === "light",
  run: (ctx) => ctx.shell.setThemeMode("light"),
};

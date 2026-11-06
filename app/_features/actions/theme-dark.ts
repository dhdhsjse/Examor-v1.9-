import type { Feature } from "@/app/_features/core/types";

export const themeDarkAction: Feature = {
  id: "action.theme.dark",
  kind: "menu-item",
  label: "Dark mode",
  order: 21,
  checked: (ctx) => ctx.shell.themeMode === "dark",
  run: (ctx) => ctx.shell.setThemeMode("dark"),
};

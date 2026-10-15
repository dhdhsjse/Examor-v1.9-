import type { Feature } from "@/app/_features/core/types";
import { UI_LANGS } from "@/app/_lib/uiLang";

export const langFrAction: Feature = {
  id: "action.lang.fr",
  kind: "menu-item",
  label: UI_LANGS[1].label,
  order: 2,
  checked: (ctx) => ctx.shell.uiLang === "fr",
  run: (ctx) => ctx.shell.setUiLang("fr"),
};

import type { Feature } from "@/app/_features/core/types";
import { UI_LANGS } from "@/app/_lib/uiLang";

export const langArAction: Feature = {
  id: "action.lang.ar",
  kind: "menu-item",
  label: UI_LANGS[2].label,
  order: 3,
  checked: (ctx) => ctx.shell.uiLang === "ar",
  run: (ctx) => ctx.shell.setUiLang("ar"),
};

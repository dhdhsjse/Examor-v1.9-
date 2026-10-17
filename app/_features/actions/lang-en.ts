import type { Feature } from "@/app/_features/core/types";
import { UI_LANGS } from "@/app/_lib/uiLang";

export const langEnAction: Feature = {
  id: "action.lang.en",
  kind: "menu-item",
  label: UI_LANGS[0].label,
  order: 11,
  separatorBefore: true,
  heading: "App language",
  checked: (ctx) => ctx.shell.uiLang === "en",
  run: (ctx) => ctx.shell.setUiLang("en"),
};

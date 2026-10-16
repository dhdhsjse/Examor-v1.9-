import { GlobeIcon } from "@/app/_features/core/ui";
import type { Group } from "@/app/_features/core/types";
import { langArAction } from "@/app/_features/actions/lang-ar";
import { langEnAction } from "@/app/_features/actions/lang-en";
import { langFrAction } from "@/app/_features/actions/lang-fr";
import { UI_LANGS } from "@/app/_lib/uiLang";

export const languageGroup: Group = {
  id: "group.language",
  order: 40,
  menu: true,
  menuAlignEnd: true,
  className: "ms-auto",
  header: (ctx) => (
    <span className="flex items-center gap-1 text-muted" title={ctx.t("App language")}>
      <GlobeIcon /> {UI_LANGS.find((l) => l.value === ctx.shell.uiLang)?.value.toUpperCase()}
    </span>
  ),
  features: [langEnAction, langFrAction, langArAction],
};

import type { Group } from "@/app/_features/core/types";
import { stickersPanel } from "@/app/_features/panels/stickers";

// The stickers of the correction sheet: only while the sheet is the document shown.
export const stickersGroup: Group = {
  id: "group.stickers",
  order: 15,
  when: (ctx) => !!ctx.shell.sheet,
  label: (t) => t("Stickers"),
  features: [stickersPanel],
};

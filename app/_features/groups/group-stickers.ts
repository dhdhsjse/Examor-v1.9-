import type { Group } from "@/app/_features/core/types";
import { stickersPanel } from "@/app/_features/panels/stickers";

// The stickers of the correction sheet: only while the sheet is the document shown. One framed block that names itself (StickerPanel), so the
// group has no heading of its own.
export const stickersGroup: Group = {
  id: "group.stickers",
  order: 15,
  when: (ctx) => !!ctx.shell.sheet,
  className: "border-b border-line p-2",
  features: [stickersPanel],
};

import StickerPanel from "@/app/_components/workspace/StickerPanel";
import type { Feature } from "@/app/_features/core/types";

// The stickers of the correction sheet, in the left toolbox while the sheet is shown (see StickerPanel).
export const stickersPanel: Feature = {
  id: "panel.stickers",
  kind: "panel",
  label: "Stickers",
  render: ({ ctx }) => {
    const { shell } = ctx;
    const sheet = shell.sheet?.config;
    return <StickerPanel stamp={shell.canvasTool === "stamp" ? shell.stamp : null} onPick={shell.setStamp} pad={!!sheet?.pad} />;
  },
};

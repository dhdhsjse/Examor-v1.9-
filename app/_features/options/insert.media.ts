import type { Option } from "@/app/_features/core/types";
import { toolInsertImage } from "@/app/_features/tools/tool-insert-image";

export const insertMediaOption: Option = {
  id: "option.insert.media",
  order: 40,
  label: (t) => t("Media"),
  features: [toolInsertImage],
};

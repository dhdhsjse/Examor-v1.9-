import type { Option } from "@/app/_features/core/types";
import { headerGalleryPanel } from "@/app/_features/panels/header-gallery";
import { toolInsertHeader } from "@/app/_features/tools/tool-insert-header";

export const layoutHeaderFooterOption: Option = {
  id: "option.layout.header-footer",
  order: 10,
  label: (t) => t("Header and footer"),
  features: [toolInsertHeader, headerGalleryPanel],
};

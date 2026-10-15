import type { Bar } from "@/app/_features/core/types";
import { brandLogoPanel } from "@/app/_features/panels/brand-logo";
import { exportGroup } from "@/app/_features/groups/group-export";
import { panelsGroup } from "@/app/_features/groups/group-panels";
import { editGroup } from "@/app/_features/groups/group-edit";
import { fileGroup } from "@/app/_features/groups/group-file";
import { languageGroup } from "@/app/_features/groups/group-language";
import { subjectsGroup } from "@/app/_features/groups/group-subjects";
import { titleGroup } from "@/app/_features/groups/group-title";
import { viewGroup } from "@/app/_features/groups/group-view";

export const topBar: Bar = {
  id: "bar.top",
  position: "top",
  order: 10,
  className: "relative z-20 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3",
  features: [brandLogoPanel],
  groups: [fileGroup, titleGroup, subjectsGroup, languageGroup, editGroup, viewGroup, panelsGroup, exportGroup],
};

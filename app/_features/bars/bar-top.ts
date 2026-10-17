import type { Bar } from "@/app/_features/core/types";
import { brandLogoPanel } from "@/app/_features/panels/brand-logo";
import { exportGroup } from "@/app/_features/groups/group-export";
import { panelsGroup } from "@/app/_features/groups/group-panels";
import { editGroup } from "@/app/_features/groups/group-edit";
import { fileGroup } from "@/app/_features/groups/group-file";
import { subjectsGroup } from "@/app/_features/groups/group-subjects";
import { titleGroup } from "@/app/_features/groups/group-title";
import { viewGroup } from "@/app/_features/groups/group-view";
import { windowGroup } from "@/app/_features/groups/group-window";

// The first row of the window (there is no native title bar): its empty parts move the window,
// and the window buttons sit at its end. No z-index on purpose: the window buttons must be able
// to rise above open dialogs; the menus carry their own z-index.
export const topBar: Bar = {
  id: "bar.top",
  position: "top",
  order: 10,
  dragRegion: true,
  className: "flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3",
  features: [brandLogoPanel],
  groups: [fileGroup, titleGroup, subjectsGroup, editGroup, viewGroup, panelsGroup, exportGroup, windowGroup],
};

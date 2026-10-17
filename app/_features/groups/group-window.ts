import type { Group } from "@/app/_features/core/types";
import { windowControlsPanel } from "@/app/_features/panels/window-controls";
import { hasWindowControls } from "@/app/_lib/desktopWindow";

// Last in the top bar, flush with the window edge. Stays clickable above open dialogs (z-[60]),
// like a native title bar.
export const windowGroup: Group = {
  id: "group.window",
  order: 100,
  when: () => hasWindowControls(),
  className: "relative z-[60] -me-3 flex h-full shrink-0 self-stretch",
  features: [windowControlsPanel],
};

import type { Feature } from "@/app/_features/core/types";
import LeftPanel from "./LeftPanel";

// The left navigation as one panel feature. It owns its own navigation state.
export const leftNavigationFeature: Feature = {
  id: "panel.left-navigation",
  kind: "panel",
  label: "Tools",
  render: ({ ctx }) => <LeftPanel ctx={ctx} />,
};

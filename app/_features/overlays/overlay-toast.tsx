import type { Feature } from "@/app/_features/core/types";

export const toastOverlay: Feature = {
  id: "overlay.toast",
  kind: "overlay",
  label: "Notification",
  render: ({ ctx }) =>
    ctx.shell.toast ? (
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
        {ctx.shell.toast}
      </div>
    ) : null,
};

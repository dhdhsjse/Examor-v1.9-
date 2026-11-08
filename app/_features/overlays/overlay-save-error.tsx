import { CloudAlert } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";

// A save of the exam on this computer failed (disk full, folder blocked): said plainly at the top, with a way to keep the work, until
// a save works again (it is tried again by itself).
export const saveErrorOverlay: Feature = {
  id: "overlay.save-error",
  kind: "overlay",
  label: "Not saved",
  render: ({ ctx }) =>
    ctx.shell.saveState.status === "error" ? (
      <div role="alert" data-testid="save-error-bar" className="fixed top-2 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-red-600 py-1.5 ps-3 pe-1.5 text-sm text-white shadow-lg">
        <CloudAlert size={16} aria-hidden />
        <span className="font-medium">{ctx.t("Your latest changes are not saved on this computer")}</span>
        <button type="button" onClick={ctx.shell.saveExamAs} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
          {ctx.t("Save as…")}
        </button>
      </div>
    ) : null,
};

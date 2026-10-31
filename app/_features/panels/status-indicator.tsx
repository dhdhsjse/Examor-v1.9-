import { Check, CloudAlert } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";

// "Saving…" while the last change is being written, then a quiet "Saved" (click: version history).
// Only a failed save stands out.
export const statusIndicatorPanel: Feature = {
  id: "panel.status",
  kind: "panel",
  label: "Save status",
  render: ({ ctx }) => {
    const save = ctx.shell.saveState;
    const t = ctx.t;
    const lang = ctx.shell.uiLang;
    const time = save.at
      ? new Date(save.at).toLocaleTimeString(lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })
      : null;
    const look =
      save.status === "error"
        ? { text: t("Not saved!"), icon: <CloudAlert size={12} strokeWidth={2} aria-hidden />, cls: "bg-red-50 text-red-700 ring-1 ring-red-200", tip: t("This computer's storage is full. Save the exam to a file (Ctrl+S) to keep your work.") }
        : save.status === "saving"
          ? { text: t("Saving…"), icon: null, cls: "text-faint", tip: t("Saving your changes on this computer…") }
          : {
              text: t("Saved"),
              icon: <Check size={12} strokeWidth={2} aria-hidden />,
              cls: "text-faint hover:bg-hover hover:text-ink",
              tip: time ? t("Saved on this computer at {time}. Click to see the version history.", { time }) : t("Everything is saved on this computer. Click to see the version history."),
            };
    return (
      <button
        onClick={ctx.shell.showHistory}
        title={look.tip}
        className={`flex h-6 shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[11px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${look.cls}`}
      >
        {look.icon}
        {look.text}
      </button>
    );
  },
};

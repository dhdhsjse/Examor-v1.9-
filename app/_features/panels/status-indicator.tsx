import type { Feature } from "@/app/_features/core/types";

// "Saving…" while the last change is being written, then "Saved ✓" (click: version history).
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
        ? { text: t("Not saved!"), cls: "bg-red-50 text-red-700 ring-red-200", tip: t("This computer's storage is full. Save the exam to a file (Ctrl+S) to keep your work.") }
        : save.status === "saving"
          ? { text: t("Saving…"), cls: "text-faint ring-transparent", tip: t("Saving your changes on this computer…") }
          : {
              text: `${t("Saved")} ✓`,
              cls: "text-emerald-700 ring-transparent hover:bg-emerald-50",
              tip: time ? t("Saved on this computer at {time}. Click to see the version history.", { time }) : t("Everything is saved on this computer. Click to see the version history."),
            };
    return (
      <button
        onClick={ctx.shell.showHistory}
        title={look.tip}
        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 transition-colors ${look.cls}`}
      >
        {look.text}
      </button>
    );
  },
};

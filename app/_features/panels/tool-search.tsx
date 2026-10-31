import type { Feature } from "@/app/_features/core/types";

// Heading of the toolbox and its search box.
export const toolSearchPanel: Feature = {
  id: "panel.tool-search",
  kind: "panel",
  label: "Search tools",
  render: ({ ctx }) => {
    const { subject, query } = ctx.shell;
    return (
      <div className="border-b border-line p-2">
        <h2 className="flex h-7 items-center px-1.5 text-xs font-semibold text-ink">{subject === "General" ? ctx.t("General tools") : ctx.t("{subject} toolbox", { subject: ctx.t(subject) })}</h2>
        <label className="mt-1 flex h-7 items-center gap-1.5 rounded-[5px] border border-transparent bg-subtle px-2 text-faint transition-colors hover:border-line focus-within:border-accent focus-within:bg-white">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9.25 9.25L12.5 12.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => ctx.shell.setQuery(e.target.value)}
            aria-label={ctx.t("Search tools")}
            placeholder={ctx.t("Search tools...")}
            className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
          />
        </label>
      </div>
    );
  },
};

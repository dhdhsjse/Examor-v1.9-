import type { Feature } from "@/app/_features/core/types";

// Heading of the toolbox and its search box.
export const toolSearchPanel: Feature = {
  id: "panel.tool-search",
  kind: "panel",
  label: "Search tools",
  render: ({ ctx }) => {
    const { subject, query } = ctx.shell;
    return (
      <div className="px-3.5 pt-3.5 pb-3">
        <h2 className="text-sm font-semibold text-ink">{subject === "General" ? ctx.t("General tools") : ctx.t("{subject} toolbox", { subject: ctx.t(subject) })}</h2>
        <label className="mt-2.5 flex h-8 items-center gap-2 rounded-md border border-line bg-subtle px-2.5 text-faint focus-within:border-indigo-300 focus-within:bg-white">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9.25 9.25L12.5 12.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => ctx.shell.setQuery(e.target.value)}
            placeholder={ctx.t("Search tools...")}
            className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
          />
        </label>
      </div>
    );
  },
};

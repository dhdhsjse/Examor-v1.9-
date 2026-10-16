import type { Ctx } from "@/app/_features/core/types";
import { formatPageList, parsePageList } from "@/app/_lib/onboarding";
import type { PageScope } from "@/app/_lib/types";

const MODES = [
  { mode: "all", label: "Every page" },
  { mode: "first", label: "First page only" },
  { mode: "pages", label: "Chosen pages" },
] as const;

interface Props {
  ctx: Ctx;
  label: string; // "Header" or "Footer"
  scope: PageScope;
  onChange: (scope: PageScope) => void;
}

// Where a header or footer appears: every page, the first one, or a list of pages.
export default function ScopePicker({ ctx, label, scope, onChange }: Props) {
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-xs font-semibold text-ink">{ctx.t(label)}</legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {MODES.map((m) => (
          <label key={m.mode} className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
            <input
              type="radio"
              name={label}
              checked={scope.mode === m.mode}
              onChange={() => onChange(m.mode === "pages" ? { mode: "pages", pages: scope.mode === "pages" ? scope.pages : [1] } : { mode: m.mode })}
            />
            {ctx.t(m.label)}
          </label>
        ))}
        {scope.mode === "pages" && (
          <input
            type="text"
            dir="ltr"
            defaultValue={formatPageList(scope.pages)}
            onChange={(e) => onChange({ mode: "pages", pages: parsePageList(e.target.value) })}
            aria-label={ctx.t("Page numbers (e.g. 1, 3-4)")}
            placeholder="1, 3-4"
            className="w-32 rounded-md border border-line px-2 py-1 text-xs"
          />
        )}
      </div>
    </fieldset>
  );
}

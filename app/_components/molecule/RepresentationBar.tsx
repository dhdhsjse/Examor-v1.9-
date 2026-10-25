"use client";

import { useT } from "@/app/_lib/uiLang";
import type { Representation } from "@/app/_molecule/model";
import { REP_CAPTION, REP_LABEL, REP_SHORT } from "@/app/_molecule/strings";

interface Props {
  representations: Representation[];
  value: Representation | undefined;
  disabled: boolean;
  onChange: (r: Representation) => void;
}

// How the molecule is drawn: one short name per tab (the full name is its tooltip), and one line saying what the
// current one shows, so that a teacher does not have to know the vocabulary to choose.
export default function RepresentationBar({ representations, value, disabled, onChange }: Props) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <div role="tablist" aria-label={t("Representation")} className="flex gap-1 rounded-xl bg-subtle p-1">
        {representations.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={value === r}
            aria-label={t(REP_LABEL[r])}
            title={t(REP_LABEL[r])}
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${value === r ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:bg-white/60 hover:text-ink"}`}
          >
            {t(REP_SHORT[r])}
          </button>
        ))}
      </div>
      {value && (
        <p className="px-1 text-xs text-muted" data-testid="rep-caption">
          {t(REP_CAPTION[value])}
        </p>
      )}
    </div>
  );
}

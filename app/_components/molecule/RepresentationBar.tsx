"use client";

import { ChevronsUpDown } from "lucide-react";
import { control } from "@/app/_components/graph-studio/fields";
import { useT } from "@/app/_lib/uiLang";
import type { Representation } from "@/app/_molecule/model";
import { REP_CAPTION, REP_LABEL } from "@/app/_molecule/strings";

interface Props {
  representations: Representation[];
  value: Representation | undefined;
  disabled: boolean;
  onChange: (r: Representation) => void;
}

// How the molecule is drawn, as one small menu with the full names (the drawing Studio has the same one). What the current one shows is
// its tooltip, so that a teacher does not have to know the vocabulary to choose.
export default function RepresentationBar({ representations, value, disabled, onChange }: Props) {
  const t = useT();
  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
      <span className="hidden xl:inline">{t("Representation")}</span>
      <span className="relative">
        <select
          value={value ?? ""}
          disabled={disabled}
          aria-label={t("Representation")}
          title={value ? t(REP_CAPTION[value]) : undefined}
          onChange={(e) => onChange(e.target.value as Representation)}
          data-testid="representation"
          className={`${control} h-7 w-44 cursor-pointer appearance-none pe-7 disabled:opacity-40`}
        >
          {representations.map((r) => (
            <option key={r} value={r}>
              {t(REP_LABEL[r])}
            </option>
          ))}
        </select>
        <ChevronsUpDown size={13} strokeWidth={2} aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

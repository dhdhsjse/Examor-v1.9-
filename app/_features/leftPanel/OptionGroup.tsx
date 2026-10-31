"use client";

import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature, Option } from "@/app/_features/core/types";
import FeatureRow from "./FeatureRow";

// One labelled option inside a section: its features as rows, or a muted placeholder when it has none yet.
export default function OptionGroup({ option, ctx, onLibrary }: { option: Option; ctx: Ctx; onLibrary: (f: Feature) => void }) {
  const label = option.label ? resolveLabel(option.label, ctx.t) : null;
  const features = [...option.features].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <section aria-label={label ?? undefined} className="flex flex-col p-2">
      {label && <h3 className="flex h-7 items-center px-1.5 text-[11px] font-semibold text-ink">{label}</h3>}
      {features.length === 0 ? (
        <p className="px-1.5 py-1.5 text-[11px] text-faint">{ctx.t("More options coming soon")}</p>
      ) : (
        features.map((f) => <FeatureRow key={f.id} feature={f} ctx={ctx} onLibrary={onLibrary} />)
      )}
    </section>
  );
}

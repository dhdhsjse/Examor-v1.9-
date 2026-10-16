"use client";

import FeatureRenderer from "./FeatureRenderer";
import GroupRenderer from "./GroupRenderer";
import type { Bar, Ctx } from "./types";

// Draws one bar: its one-off features first, then its groups in order.
// The bar's `className` decides its geometry.
export default function BarRenderer({ bar, ctx }: { bar: Bar; ctx: Ctx }) {
  if (bar.collapsible && ctx.shell.hiddenBars.includes(bar.id)) return null;
  const groups = [...bar.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <div className={bar.className} data-bar={bar.id}>
      {(bar.features ?? []).map((f) => (
        <FeatureRenderer key={f.id} feature={f} ctx={ctx} />
      ))}
      {groups.map((g) => (
        <GroupRenderer key={g.id} group={g} ctx={ctx} />
      ))}
    </div>
  );
}

"use client";

import Dropdown from "./Dropdown";
import FeatureRenderer, { resolveLabel } from "./FeatureRenderer";
import type { Ctx, Feature, Group } from "./types";

// Search filter (left toolbox): tools match on their English name or their translation.
function matches(feature: Feature, ctx: Ctx) {
  const q = ctx.shell.query.trim().toLowerCase();
  if (!q || feature.kind !== "tool") return true;
  const english = typeof feature.label === "string" ? feature.label : "";
  return english.toLowerCase().includes(q) || resolveLabel(feature.label, ctx.t).toLowerCase().includes(q);
}

// An ordered group of features. Hidden when its `when` is false or when a search leaves nothing.
export default function GroupRenderer({ group, ctx }: { group: Group; ctx: Ctx }) {
  if (group.when && !group.when(ctx)) return null;
  const features = group.features.filter((f) => matches(f, ctx)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (features.length === 0 && group.features.length > 0) return null;
  const label = group.label ? resolveLabel(group.label, ctx.t) : null;

  if (group.menu) {
    return (
      <Dropdown
        trigger={group.header?.(ctx) ?? label}
        alignEnd={group.menuAlignEnd}
        className={group.className}
        items={features.map((f) => ({
          label: resolveLabel(f.label, ctx.t),
          hint: f.hotkey,
          checked: f.checked?.(ctx),
          separator: f.separatorBefore,
          onClick: () => void f.run?.(ctx),
        }))}
      />
    );
  }

  const list = <div className={group.className}>{features.map((f) => <FeatureRenderer key={f.id} feature={f} ctx={ctx} />)}</div>;
  if (!label) return list;
  return (
    <section aria-label={label}>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</h3>
      {list}
    </section>
  );
}

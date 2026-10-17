"use client";

import CollapsibleBar from "./CollapsibleBar";
import FeatureRenderer from "./FeatureRenderer";
import GroupRenderer from "./GroupRenderer";
import type { Bar, Ctx } from "./types";

// Draws one bar: its one-off features first, then its groups in order.
// The bar's `className` decides its geometry. A bar with `collapse` gets a frame that can close it.
export default function BarRenderer({ bar, ctx }: { bar: Bar; ctx: Ctx }) {
  const groups = [...bar.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const content = (
    <>
      {(bar.features ?? []).map((f) => (
        <FeatureRenderer key={f.id} feature={f} ctx={ctx} />
      ))}
      {groups.map((g) => (
        <GroupRenderer key={g.id} group={g} ctx={ctx} />
      ))}
    </>
  );

  if (bar.collapse) {
    return (
      <CollapsibleBar bar={bar} collapse={bar.collapse} ctx={ctx}>
        {content}
      </CollapsibleBar>
    );
  }
  return (
    // "deep": a press on any empty part of the bar drags the desktop window. Buttons, inputs and
    // links inside stay clickable (Tauri skips them), and a double-click maximizes / restores.
    <div className={bar.className} data-bar={bar.id} data-tauri-drag-region={bar.dragRegion ? "deep" : undefined}>
      {content}
    </div>
  );
}

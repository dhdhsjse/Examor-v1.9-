"use client";

import { useEffect, useState } from "react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature } from "@/app/_features/core/types";
import { sections } from "@/app/_features/sections";
import FeatureRow from "./FeatureRow";
import SectionDetail from "./SectionDetail";
import SectionList from "./SectionList";

// Tools whose English or translated name (or one of their search tags) contains the search text.
function matches(feature: Feature, ctx: Ctx, q: string) {
  const english = typeof feature.label === "string" ? feature.label : "";
  return (
    english.toLowerCase().includes(q) ||
    resolveLabel(feature.label, ctx.t).toLowerCase().includes(q) ||
    !!feature.tags?.some((tag) => tag.toLowerCase().includes(q))
  );
}

// The left navigation: a list of sections, then one section's options. While the search bar has text,
// the sections give way to the matching tools.
export default function LeftPanel({ ctx }: { ctx: Ctx }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const q = ctx.shell.query.trim().toLowerCase();
  const open = sections.find((s) => s.id === openId);

  // Escape returns from a section to the section list.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  if (q) {
    const hits = sections.flatMap((s) => s.options.flatMap((o) => o.features)).filter((f) => f.kind === "tool" && matches(f, ctx, q));
    return <div className="flex flex-col gap-0.5 p-2">{hits.map((f) => <FeatureRow key={f.id} feature={f} ctx={ctx} />)}</div>;
  }

  if (open) return <SectionDetail section={open} ctx={ctx} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex flex-col">
      <h3 className="px-4 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{ctx.t("Tools")}</h3>
      <SectionList sections={sections} ctx={ctx} onOpen={setOpenId} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature } from "@/app/_features/core/types";
import { findSectionFeature, sectionFeatures, sections } from "@/app/_features/sections";
import FeatureRow from "./FeatureRow";
import LibraryView from "./LibraryView";
import SectionDetail from "./SectionDetail";
import SectionList from "./SectionList";

// Where the panel is: the section list, one section, or one tool's library (opened from a section or from search).
// (Inspector features open in the right panel, so they are not a view here.)
type View = { kind: "list" } | { kind: "section"; sectionId: string } | { kind: "library"; sectionId: string | null; featureId: string };

// Tools whose English or translated name (or one of their search tags) contains the search text.
function matches(feature: Feature, ctx: Ctx, q: string) {
  const english = typeof feature.label === "string" ? feature.label : "";
  return (
    english.toLowerCase().includes(q) ||
    resolveLabel(feature.label, ctx.t).toLowerCase().includes(q) ||
    !!feature.tags?.some((tag) => tag.toLowerCase().includes(q))
  );
}

// The left navigation. A library goes back to its section (or to the list when opened from search);
// while the search bar has text, the sections give way to the matching tools.
export default function LeftPanel({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const q = ctx.shell.query.trim().toLowerCase();

  const back = () => setView((v) => (v.kind === "library" && v.sectionId ? { kind: "section", sectionId: v.sectionId } : { kind: "list" }));
  const openLibrary = (feature: Feature, sectionId: string | null) => setView({ kind: "library", sectionId, featureId: feature.id });

  // Escape goes one level back.
  useEffect(() => {
    if (view.kind === "list") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  if (view.kind === "library") {
    const feature = findSectionFeature(view.featureId);
    if (feature?.library) {
      return (
        <LibraryView
          ctx={ctx}
          feature={feature}
          onBack={back}
          onChoose={(tpl) => {
            ctx.shell.runTool({ kind: "block", ...tpl.item(ctx) });
            back();
          }}
        />
      );
    }
  }

  if (q) {
    const hits = sectionFeatures().filter((f) => f.kind === "tool" && matches(f, ctx, q));
    return (
      <div className="flex flex-col gap-0.5 p-2">
        {hits.map((f) => (
          <FeatureRow key={f.id} feature={f} ctx={ctx} onLibrary={(feat) => openLibrary(feat, null)} />
        ))}
      </div>
    );
  }

  const open = view.kind === "section" ? sections.find((s) => s.id === view.sectionId) : undefined;
  if (open) return <SectionDetail section={open} ctx={ctx} onBack={back} onLibrary={(f) => openLibrary(f, open.id)} />;

  return (
    <div className="flex flex-col">
      <h3 className="px-4 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{ctx.t("Tools")}</h3>
      <SectionList sections={sections} ctx={ctx} onOpen={(sectionId) => setView({ kind: "section", sectionId })} />
    </div>
  );
}

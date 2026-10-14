"use client";

import { useState } from "react";
import { BUILTIN_ASSETS, matchesFilter, svgUrl, type Asset, type AssetKind, type LibraryFilter } from "@/app/_lib/library";
import { ALL_CYCLES, CYCLES, SUBJECTS, type Cycle, type SchoolSubject, type Subject } from "@/app/_lib/subjects";
import { DRAG_MIME } from "@/app/_lib/tools";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  subject: Subject; // top-bar subject = default subject filter
  initialKind: AssetKind | "all";
  userAssets: Asset[];
  onUse: (asset: Asset) => void;
  onImport: () => void;
  onDeleteUserAsset: (id: string) => void;
}

const selectCls =
  "h-7 w-full rounded-md border border-line bg-white px-1.5 text-[11px] text-ink outline-none focus:border-indigo-400";

const KINDS: { value: AssetKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "diagram", label: "Diagrams" },
  { value: "table", label: "Tables" },
  { value: "image", label: "My images" },
];

// Smart library: diagrams, tables and imported images, filtered by cycle / year / subject.
// Click an item to add it, or drag it onto the page.
export default function LibraryPanel({ subject, initialKind, userAssets, onUse, onImport, onDeleteUserAsset }: Props) {
  const t = useT();
  const [filter, setFilter] = useState<LibraryFilter>({
    query: "",
    cycle: "all",
    year: "all",
    subject: subject === "General" ? "all" : subject,
    kind: initialKind,
  });
  const set = (patch: Partial<LibraryFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const years = filter.cycle === "all" ? ALL_CYCLES.flatMap((c) => CYCLES[c].years) : CYCLES[filter.cycle].years;
  // Search in English and in the app's language.
  const items = [...userAssets, ...BUILTIN_ASSETS].filter(
    (a) => matchesFilter(a, { ...filter, query: "" }) && (!filter.query.trim() || matchesFilter(a, filter) || t(a.name).toLowerCase().includes(filter.query.trim().toLowerCase())),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <input
            value={filter.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={t("Search library...")}
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-subtle px-2 text-xs outline-none focus:border-indigo-300 focus:bg-white"
          />
          <button
            onClick={onImport}
            title={t("Import an image from your computer")}
            className="h-7 shrink-0 rounded-md bg-indigo-600 px-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
          >
            + {t("Import")}
          </button>
        </div>

        {/* Cycle / Year / Subject */}
        <div className="grid grid-cols-3 gap-1.5">
          <select
            value={filter.cycle}
            onChange={(e) => set({ cycle: e.target.value as Cycle | "all", year: "all" })}
            className={selectCls}
            aria-label={t("Cycle")}
          >
            <option value="all">{t("All cycles")}</option>
            {ALL_CYCLES.map((c) => (
              <option key={c} value={c}>
                {t(CYCLES[c].label)}
              </option>
            ))}
          </select>
          <select value={filter.year} onChange={(e) => set({ year: e.target.value })} className={selectCls} aria-label={t("Year")}>
            <option value="all">{t("All years")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={filter.subject}
            onChange={(e) => set({ subject: e.target.value as SchoolSubject | "all" })}
            className={selectCls}
            aria-label={t("Subject")}
          >
            <option value="all">{t("All subjects")}</option>
            {SUBJECTS.filter((s) => s !== "General").map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => set({ kind: k.value })}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                filter.kind === k.value ? "bg-amber-100 text-amber-800" : "text-muted hover:bg-subtle"
              }`}
            >
              {t(k.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3">
        {items.map((a) => (
          <AssetCard key={a.id} asset={a} onUse={onUse} onDelete={a.id.startsWith("user-") ? onDeleteUserAsset : undefined} />
        ))}
        {items.length === 0 && (
          <p className="col-span-2 pt-8 text-center text-xs text-faint">
            {t("Nothing matches these filters.")}
            {filter.kind === "image" && ` ${t("Click “+ Import” to add your own images.")}`}
          </p>
        )}
      </div>
    </div>
  );
}

function AssetCard({ asset, onUse, onDelete }: { asset: Asset; onUse: (a: Asset) => void; onDelete?: (id: string) => void }) {
  const t = useT();
  // Built-in items have English names (translated); imported images keep their file name.
  const name = asset.id.startsWith("user-") ? asset.name : t(asset.name);
  return (
    <div className="group relative">
      <button
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "asset", assetId: asset.id }));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onUse(asset)}
        title={t("{label} — click or drag onto the page", { label: name })}
        className="flex w-full flex-col overflow-hidden rounded-lg border border-line bg-white text-start transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
      >
        <div className="grid h-20 w-full place-items-center bg-subtle p-2">
          <AssetPreview asset={asset} />
        </div>
        <span className="truncate px-2 py-1.5 text-[11px] font-medium text-ink" dir="auto">
          {name}
        </span>
      </button>
      {onDelete && (
        <button
          onClick={() => onDelete(asset.id)}
          title={t("Remove from library")}
          className="absolute top-1 end-1 hidden size-5 place-items-center rounded-full bg-white text-faint shadow ring-1 ring-black/10 group-hover:grid hover:text-red-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.kind === "table") {
    const rows = (asset.cells ?? []).slice(0, 4);
    return (
      <div className="grid w-full gap-px overflow-hidden rounded-sm bg-slate-400 p-px" style={{ gridTemplateColumns: `repeat(${Math.min(4, rows[0]?.length ?? 1)}, 1fr)` }}>
        {rows.flatMap((row, r) =>
          row.slice(0, 4).map((cell, c) => (
            <span key={`${r}-${c}`} dir="auto" className={`truncate px-0.5 text-[7px] leading-3 ${r === 0 ? "bg-slate-100 font-semibold" : "bg-white"}`}>
              {cell || " "}
            </span>
          )),
        )}
      </div>
    );
  }
  const src = asset.svg ? svgUrl(asset.svg) : asset.src;
  // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
  return <img src={src} alt="" className="max-h-full max-w-full object-contain" draggable={false} />;
}

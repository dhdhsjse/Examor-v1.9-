"use client";

import { Bookmark, ImagePlus, Search, SearchX, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BLOCK_TYPE_NAMES } from "@/app/_lib/blocks";
import { renderFigure } from "@/app/_lib/figures";
import { BUILTIN_ASSETS, matchesFilter, svgUrl, type Asset, type AssetKind, type LibraryFilter } from "@/app/_lib/library";
import type { Lang } from "@/app/_lib/types";
import { SUBJECTS, type SchoolSubject, type Subject } from "@/app/_lib/subjects";
import { DRAG_MIME } from "@/app/_lib/tools";
import { useT } from "@/app/_lib/uiLang";
import { MenuSelect, Row, TextAction, inputCls } from "../inspector/fields";

interface Props {
  lang: Lang; // exam language: figures are drawn with its words
  subject: Subject; // top-bar subject = default subject filter
  initialKind: AssetKind | "all";
  userAssets: Asset[];
  onUse: (asset: Asset) => void;
  onImport: () => void;
  onDeleteUserAsset: (id: string) => void;
}

type Kind = AssetKind | "all";

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "diagram", label: "Diagrams" },
  { value: "table", label: "Tables" },
  { value: "image", label: "My images" },
  { value: "block", label: "My blocks" },
];

// The sections of the list, in their order. `mine`: what the teacher keeps here (the others come with the app).
const SECTIONS: { kind: AssetKind; label: string; mine: boolean }[] = [
  { kind: "diagram", label: "Diagrams", mine: false },
  { kind: "table", label: "Tables", mine: false },
  { kind: "image", label: "My images", mine: true },
  { kind: "block", label: "My blocks", mine: true },
];

// The panel's buttons: 28px high, 5px corners, the accent ring on keyboard focus (as in the Properties panel).
const buttonCls = "flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
const quietButtonCls = `${buttonCls} bg-surface text-ink ring-1 ring-line hover:bg-hover`;
const mainButtonCls = `${buttonCls} bg-accent text-white hover:bg-accent-strong focus-visible:ring-offset-1`;

// Smart library: diagrams, tables, imported images and saved blocks.
// Click an item to add it, or drag it onto the page.
//  · on top: the search, the Filters button (the subject, closed until asked for) and the kinds;
//  · the list: one section per kind with its count, what comes with the app first, then what is the teacher's
//    (Import sits with "My images", where the picture lands).
export default function LibraryPanel({ lang, subject, initialKind, userAssets, onUse, onImport, onDeleteUserAsset }: Props) {
  const t = useT();
  const [filter, setFilter] = useState<LibraryFilter>({
    query: "",
    cycle: "all",
    year: "all",
    subject: subject === "General" ? "all" : subject,
    kind: initialKind,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<LibraryFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const query = filter.query.trim();
  // (the library is only sorted by subject: the cycle and the year of the filter stay on "all")
  const activeFilters = filter.subject === "all" ? 0 : 1;
  const resetFilters = () => set({ subject: "all" });
  const clearSearch = () => {
    set({ query: "" });
    search.current?.focus();
  };

  // Search in English and in the app's language.
  const items = [...userAssets, ...BUILTIN_ASSETS].filter(
    (a) => matchesFilter(a, { ...filter, query: "" }) && (!query || matchesFilter(a, filter) || t(a.name).toLowerCase().includes(query.toLowerCase())),
  );

  // An empty section shows how to fill it ("start": mine, with nothing kept yet), says that nothing matches ("none": it is the
  // only one asked for), or is left out of the list.
  const sections = SECTIONS.filter((s) => filter.kind === "all" || filter.kind === s.kind)
    .map((s) => {
      const found = items.filter((a) => a.kind === s.kind);
      const alone = filter.kind === s.kind;
      const kept = userAssets.some((a) => a.kind === s.kind);
      const empty = found.length ? null : s.mine && !kept && (alone || !query) ? ("start" as const) : alone ? ("none" as const) : ("hide" as const);
      return { ...s, found, empty };
    })
    .filter((s) => s.empty !== "hide");
  const builtIn = sections.filter((s) => !s.mine);
  const mine = sections.filter((s) => s.mine);
  const grouped = filter.kind === "all";

  // After a removal the keyboard stays in the list: on the card that took the place of the removed one.
  const remove = (assetId: string) => {
    const cards = [...(list.current?.querySelectorAll<HTMLElement>("[data-asset]") ?? [])];
    const i = cards.findIndex((c) => c.dataset.asset === assetId);
    const next = (cards[i + 1] ?? cards[i - 1])?.dataset.asset;
    onDeleteUserAsset(assetId);
    requestAnimationFrame(() => {
      const card = next ? list.current?.querySelector<HTMLElement>(`[data-asset="${CSS.escape(next)}"] button`) : null;
      (card ?? list.current)?.focus();
    });
  };

  const nothing = (canReset: boolean) => (
    <EmptyState icon={<SearchX size={18} aria-hidden />} text={query ? t("Nothing matches “{q}”.", { q: query }) : t("Nothing matches these filters.")}>
      {(query || canReset) && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {query && (
            <button type="button" onClick={clearSearch} className={quietButtonCls}>
              {t("Clear search")}
            </button>
          )}
          {canReset && (
            <button type="button" onClick={resetFilters} className={quietButtonCls}>
              {t("Reset filters")}
            </button>
          )}
        </div>
      )}
    </EmptyState>
  );

  const section = (s: (typeof sections)[number]) => (
    <Section
      key={s.kind}
      id={`${id}-${s.kind}`}
      label={t(s.label)}
      count={s.found.length}
      // (an empty "My images" has the button in its middle)
      action={
        s.kind === "image" &&
        s.empty !== "start" && (
          <button
            type="button"
            onClick={onImport}
            title={t("Import an image from your computer")}
            className="flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-xs font-medium text-accent-strong outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Upload size={12} strokeWidth={2} aria-hidden /> {t("Import")}
          </button>
        )
      }
    >
      {s.empty === "start" && s.kind === "image" && (
        <EmptyState icon={<ImagePlus size={18} aria-hidden />} text={t("Your imported images are kept here.")}>
          <button type="button" onClick={onImport} className={mainButtonCls}>
            <Upload size={13} aria-hidden /> {t("Import an image")}
          </button>
        </EmptyState>
      )}
      {s.empty === "start" && s.kind === "block" && <SaveBlockHelp />}
      {/* (the subject only sorts what comes with the app: resetting it brings nothing of the teacher's back) */}
      {s.empty === "none" && nothing(!s.mine && activeFilters > 0)}
      {!s.empty && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {s.found.map((a) => (
            <AssetCard key={a.id} asset={a} lang={lang} onUse={onUse} onDelete={a.id.startsWith("user-") ? remove : undefined} />
          ))}
        </ul>
      )}
    </Section>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search size={13} strokeWidth={2} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input
              ref={search}
              value={filter.query}
              onChange={(e) => set({ query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== "Escape" || !filter.query) return;
                e.stopPropagation();
                set({ query: "" });
              }}
              placeholder={t("Search")}
              aria-label={t("Search library...")}
              className={`${inputCls.replace("px-2 ", "")} h-7 ps-7 ${filter.query ? "pe-7" : "pe-2"}`}
            />
            {filter.query && (
              <button
                type="button"
                onClick={clearSearch}
                title={t("Clear search")}
                aria-label={t("Clear search")}
                className="absolute end-0.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-[4px] text-faint outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={filtersOpen ? `${id}-filters` : undefined}
            aria-label={activeFilters ? t("Filters: {n} active", { n: activeFilters }) : undefined}
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`${buttonCls} ${filtersOpen ? "bg-accent-soft text-accent-strong" : "bg-subtle text-ink hover:bg-hover"}`}
          >
            <SlidersHorizontal size={13} strokeWidth={2} aria-hidden />
            {t("Filters")}
            {activeFilters > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-white tabular-nums">{activeFilters}</span>
            )}
          </button>
        </div>

        {/* The subject: closed until asked for (Reset shows once a subject is chosen) */}
        {filtersOpen && (
          <div id={`${id}-filters`} role="group" aria-label={t("Filters")}>
            <Row label={t("Subject")}>
              {activeFilters > 0 && <TextAction onClick={resetFilters}>{t("Reset")}</TextAction>}
              <MenuSelect
                label={t("Subject")}
                value={filter.subject}
                onChange={(s: SchoolSubject | "all") => set({ subject: s })}
                options={[{ value: "all", label: t("All subjects") }, ...SUBJECTS.filter((s): s is SchoolSubject => s !== "General").map((s) => ({ value: s, label: t(s) }))]}
              />
            </Row>
          </div>
        )}

        <KindTabs id={id} value={filter.kind} onChange={(kind) => set({ kind })} />
      </div>

      <div ref={list} id={`${id}-list`} role="tabpanel" aria-labelledby={`${id}-tab-${filter.kind}`} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 outline-none">
        {sections.length === 0 ? (
          <div className="pt-3">{nothing(activeFilters > 0)}</div>
        ) : grouped ? (
          <>
            <GroupTitle>{t("Ready-made")}</GroupTitle>
            {builtIn.length ? builtIn.map(section) : <div className="pt-2">{nothing(activeFilters > 0)}</div>}
            {mine.length > 0 && (
              <div className="mt-4 border-t border-line">
                <GroupTitle>{t("My library")}</GroupTitle>
                {mine.map(section)}
              </div>
            )}
          </>
        ) : (
          sections.map(section)
        )}
      </div>
    </div>
  );
}

// The kinds, as tabs on one line. In a narrow panel the line scrolls sideways (wheel, drag, arrow keys): it fades out on the side
// where more tabs wait, and the chosen tab is always brought into view.
function KindTabs({ id, value, onChange }: { id: string; value: Kind; onChange: (v: Kind) => void }) {
  const t = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false, rtl: false });

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const at = Math.abs(el.scrollLeft); // (negative in a right-to-left strip)
      const next = { start: at > 1, end: at < max - 1, rtl: getComputedStyle(el).direction === "rtl" };
      setEdge((e) => (e.start === next.start && e.end === next.end && e.rtl === next.rtl ? e : next));
    };
    // (the strip: the panel is resized; its row of tabs: another language, other widths)
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    if (el.firstElementChild) watch.observe(el.firstElementChild);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      watch.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  // Bring the chosen tab clear of the faded edges. (Not scrollIntoView: it would also move the panel that slides closed.)
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>("[aria-selected=true]");
    if (!el || !tab) return;
    const box = el.getBoundingClientRect();
    const r = tab.getBoundingClientRect();
    const clear = 24;
    const left = r.left < box.left + clear ? r.left - box.left - clear : r.right > box.right - clear ? r.right - box.right + clear : 0;
    if (left) el.scrollBy({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = KINDS.findIndex((k) => k.value === value);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = step ? (i + (edge.rtl ? -step : step) + KINDS.length) % KINDS.length : e.key === "Home" ? 0 : e.key === "End" ? KINDS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(KINDS[to].value);
    strip.current?.querySelectorAll<HTMLElement>("[role=tab]")[to]?.focus({ preventScroll: true });
  };

  const fade = (on: boolean) => (on ? 20 : 0);
  const mask =
    edge.start || edge.end
      ? `linear-gradient(to ${edge.rtl ? "left" : "right"}, transparent, #000 ${fade(edge.start)}px, #000 calc(100% - ${fade(edge.end)}px), transparent)`
      : undefined;

  return (
    <div
      ref={strip}
      onWheel={(e) => {
        // A mouse wheel turns the strip too.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollBy({ left: edge.rtl ? -e.deltaY : e.deltaY });
      }}
      className="-mx-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div role="tablist" aria-label={t("Kind")} onKeyDown={onKeyDown} className="flex w-max gap-0.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="tab"
            id={`${id}-tab-${k.value}`}
            aria-selected={k.value === value}
            aria-controls={`${id}-list`}
            tabIndex={k.value === value ? 0 : -1}
            onClick={() => onChange(k.value)}
            className={`h-7 shrink-0 rounded-[5px] px-2 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
              k.value === value ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            {t(k.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Ready-made" / "My library": what comes with the app, and what is the teacher's.
function GroupTitle({ children }: { children: ReactNode }) {
  return <h2 className="pt-3 text-[11px] font-semibold tracking-wide text-faint uppercase">{children}</h2>;
}

// A kind of item: its name, how many there are and an action at the end (the line stays in view while its items scroll), then its items.
function Section({ id, label, count, action, children }: { id: string; label: string; count: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="sticky top-0 z-10 -mx-3 flex min-h-9 items-center gap-2 bg-surface px-3 pt-1.5 pb-1">
        <h3 id={id} className="flex min-w-0 items-baseline gap-1.5 text-xs font-semibold text-ink">
          <span className="truncate">{label}</span>
          <span className="font-normal text-faint tabular-nums">{count}</span>
        </h3>
        {action && <span className="ms-auto shrink-0">{action}</span>}
      </div>
      {children}
    </section>
  );
}

// Nothing to show: a picture of what is missing, one line, and the next step (`children`).
function EmptyState({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-subtle px-3 py-5 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-surface text-muted">{icon}</span>
      <p className="text-xs leading-snug text-muted">{text}</p>
      {children}
    </div>
  );
}

// "My blocks" with nothing in it: the button shows how a block gets here.
function SaveBlockHelp() {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <EmptyState icon={<Bookmark size={18} aria-hidden />} text={t("Keep the blocks you reuse here.")}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={quietButtonCls}>
        {t("How to save a block")}
      </button>
      <p id={id} hidden={!open} className="rounded-[5px] bg-surface px-2.5 py-2 text-start text-xs leading-snug text-ink">
        {t("Select a block on the page and click its bookmark button to keep it here.")}
      </p>
    </EmptyState>
  );
}

function AssetCard({ asset, lang, onUse, onDelete }: { asset: Asset; lang: Lang; onUse: (a: Asset) => void; onDelete?: (id: string) => void }) {
  const t = useT();
  // Built-in items have English names (translated); imported images keep their file name.
  const name = asset.id.startsWith("user-") ? asset.name : t(asset.name);
  return (
    <li className="relative" data-asset={asset.id}>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "asset", assetId: asset.id }));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onUse(asset)}
        title={t("{label} — click or drag onto the page", { label: name })}
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-start outline-none transition-[border-color,box-shadow] hover:border-accent hover:shadow-sm focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* A piece of paper: light in both looks, so the black lines of a drawing read as on the page */}
        <span data-paper="" className="relative block aspect-square w-full bg-subtle">
          <span className="absolute inset-0 flex items-center justify-center p-2">
            <AssetPreview asset={asset} lang={lang} />
          </span>
        </span>
        {/* (the whole name on two lines; a longer one in the tooltip) */}
        <span className="block px-2 py-1.5">
          <span dir="auto" className="line-clamp-2 text-xs leading-4 font-medium text-ink [overflow-wrap:anywhere]">
            {name}
          </span>
        </span>
      </button>
      {onDelete && <DeleteButton name={name} onDelete={() => onDelete(asset.id)} />}
    </li>
  );
}

// Removes an item of the teacher's. Always there (no hover needed: keyboard, touch), so it asks once: the first press arms it
// ("Remove?"), the second removes. It disarms by itself: Escape, moving on, or a few seconds.
function DeleteButton({ name, onDelete }: { name: string; onDelete: () => void }) {
  const t = useT();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <>
      <button
        type="button"
        title={t("Remove from library")}
        aria-label={t("Remove “{name}” from library", { name })}
        onClick={() => (armed ? onDelete() : setArmed(true))}
        onBlur={() => setArmed(false)}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !armed) return;
          e.stopPropagation();
          setArmed(false);
        }}
        className={`absolute end-1 top-1 flex h-6 items-center justify-center gap-1 rounded-[5px] text-[11px] leading-none font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
          armed ? "bg-red-600 px-1.5 text-white" : "w-6 bg-surface text-muted ring-1 ring-line hover:bg-red-50 hover:text-red-700"
        }`}
      >
        <Trash2 size={13} strokeWidth={2} aria-hidden />
        {armed && t("Remove?")}
      </button>
      <span role="status" className="sr-only">
        {armed ? t("Press again to remove “{name}”", { name }) : ""}
      </span>
    </>
  );
}

function AssetPreview({ asset, lang }: { asset: Asset; lang: Lang }) {
  const t = useT();
  // Figures are drawn from their default settings (only once per card).
  const figureSvg = useMemo(() => (asset.figure ? renderFigure(asset.figure.id, asset.figure.params, lang)?.svg : undefined), [asset.figure, lang]);
  // A saved picture or figure shows itself.
  const savedPicture = asset.block?.preset && "src" in asset.block.preset ? asset.block.preset.src : undefined;
  if (asset.block && !asset.svg && !savedPicture) {
    // A saved block: its kind, and the start of its text.
    return (
      <span className="flex size-full flex-col items-start gap-1 overflow-hidden rounded-md bg-surface p-2 text-start ring-1 ring-line">
        <span className="rounded bg-accent-soft px-1 py-0.5 text-[9px] leading-none font-bold text-accent-strong uppercase">{t(BLOCK_TYPE_NAMES[asset.block.type])}</span>
        <span className="line-clamp-4 text-[10px] leading-snug text-muted" dir="auto">
          {asset.name}
        </span>
      </span>
    );
  }
  if (asset.kind === "table") {
    const rows = (asset.cells ?? []).slice(0, 4);
    return (
      <span className="grid w-full gap-px overflow-hidden rounded-sm bg-faint p-px" style={{ gridTemplateColumns: `repeat(${Math.min(4, rows[0]?.length ?? 1)}, minmax(0, 1fr))` }}>
        {rows.flatMap((row, r) =>
          row.slice(0, 4).map((cell, c) => (
            <span key={`${r}-${c}`} dir="auto" className={`truncate px-0.5 text-[8px] leading-[14px] text-ink ${r === 0 ? "bg-subtle font-semibold" : "bg-surface"}`}>
              {cell || " "}
            </span>
          )),
        )}
      </span>
    );
  }
  const svg = figureSvg ?? asset.svg;
  const src = svg ? svgUrl(svg) : (savedPicture ?? asset.src);
  // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
  return <img src={src} alt="" className="size-full object-contain" draggable={false} />;
}

"use client";

import { Bookmark, ChevronLeft, Grid2x2, Grid3x3, ImagePlus, Search, SearchX, Square, Trash2, Upload, X } from "lucide-react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { BLOCK_TYPE_NAMES } from "@/app/_lib/blocks";
import { renderFigure } from "@/app/_lib/figures";
import { BUILTIN_ASSETS, PACK_ASSETS, svgUrl, type Asset, type AssetKind } from "@/app/_lib/library";
import { PACK_CATEGORIES } from "@/app/_lib/libraryPack";
import { matchesQuery, searchTerms } from "@/app/_lib/searchText";
import type { SchoolSubject, Subject } from "@/app/_lib/subjects";
import { DRAG_MIME } from "@/app/_lib/tools";
import type { Lang } from "@/app/_lib/types";
import { useT, useUi, type T } from "@/app/_lib/uiLang";
import { TextAction, inputCls } from "../inspector/fields";

interface Props {
  lang: Lang; // exam language: figures are drawn with its words
  subject: Subject; // top-bar subject: its shelf comes first
  initialKind: AssetKind | "all"; // "image" / "block": open on My images / My blocks (after an import, …)
  userAssets: Asset[];
  onUse: (asset: Asset) => void;
  onImport: () => void;
  onDeleteUserAsset: (id: string) => void;
}

// The library is a set of shelves: the diagrams and tables of each subject, the categories of the picture pack (libraryPack.ts),
// and what the teacher keeps. A shelf can have parts (Farm / Wild / Sea, Diagrams / Tables).
interface Shelf {
  id: string;
  group: "subjects" | "pictures" | "learning" | "mine";
  label: string;
  items: Asset[];
  parts: { id: string; label: string; items: Asset[] }[];
  icon?: ReactNode; // for an empty shelf (nothing kept yet)
}

type Size = "s" | "m" | "l";
const SIZE_KEY = "examBuilder.library.size";
const RECENT_KEY = "examBuilder.library.recent";
const RECENT_MAX = 8;

// Cards per size: small (4 in a row, no names), medium (3), large (2). Category tiles are always medium.
const GRID: Record<Size, string> = {
  s: "grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5",
  m: "grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5",
  l: "grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2",
};
// How many results a group shows before "Show all".
const PREVIEW: Record<Size, number> = { s: 8, m: 6, l: 4 };

// The panel's buttons: 28px high, 5px corners, the accent ring on keyboard focus (as in the Properties panel).
const buttonCls = "flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
const quietButtonCls = `${buttonCls} bg-surface text-ink ring-1 ring-line hover:bg-hover`;
const mainButtonCls = `${buttonCls} bg-accent text-white hover:bg-accent-strong focus-visible:ring-offset-1`;
const cardCls =
  "flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-start outline-none transition-[border-color,box-shadow] hover:border-accent hover:shadow-sm focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

const load = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

function buildShelves(userAssets: Asset[], subject: Subject, t: T, uiLang: "en" | "fr" | "ar"): Shelf[] {
  const ready = BUILTIN_ASSETS.filter((a) => a.kind === "diagram" || a.kind === "table");
  const of = (subjects: SchoolSubject[]) => ready.filter((a) => a.subjects !== "all" && subjects.some((s) => a.subjects.includes(s)));
  const byKind = (items: Asset[]) => {
    const diagrams = items.filter((a) => a.kind === "diagram");
    const tables = items.filter((a) => a.kind === "table");
    return diagrams.length && tables.length
      ? [
          { id: "diagram", label: t("Diagrams"), items: diagrams },
          { id: "table", label: t("Tables"), items: tables },
        ]
      : [];
  };
  // A subject with its own category in the pack (Sciences): its first part is the other diagrams and tables, then one part per topic.
  const byTopic = (subject: SchoolSubject, items: Asset[]) => {
    const category = PACK_CATEGORIES.find((c) => c.subject === subject);
    if (!category) return byKind(items);
    const others = items.filter((a) => a.pack?.category !== category.id);
    return [
      ...(others.length ? [{ id: "general", label: t("General"), items: others }] : []),
      ...(category.subcategories ?? []).map((s) => ({ id: s.id, label: s.names[uiLang], items: items.filter((a) => a.pack?.category === category.id && a.pack.subcategory === s.id) })),
    ];
  };
  const shelf = (id: string, label: string, items: Asset[], parts = byKind(items)): Shelf => ({ id, group: "subjects", label, items, parts });
  const subjectShelf = (subject: SchoolSubject) => shelf(subject, t(subject), of([subject]), byTopic(subject, of([subject])));
  const subjects = [
    subjectShelf("Math"),
    subjectShelf("Physics"),
    subjectShelf("Sciences"),
    shelf("languages", t("Languages"), of(["French", "Arabic"]), [
      { id: "French", label: t("French"), items: of(["French"]) },
      { id: "Arabic", label: t("Arabic"), items: of(["Arabic"]) },
    ]),
    shelf("every", t("Every subject"), ready.filter((a) => a.subjects === "all")),
  ].filter((s) => s.items.length);
  // The exam's subject first.
  const first = subject === "French" || subject === "Arabic" ? "languages" : subject;
  subjects.sort((a, b) => Number(b.id === first) - Number(a.id === first));

  // (a subject's category is in its subject's shelf)
  const pictures: Shelf[] = PACK_CATEGORIES.filter((c) => c.group !== "subjects").map((c) => {
    const items = PACK_ASSETS.filter((a) => a.pack?.category === c.id);
    return {
      id: `pack-${c.id}`,
      group: c.group as Shelf["group"],
      label: c.names[uiLang],
      items,
      parts: (c.subcategories ?? []).map((s) => ({ id: s.id, label: s.names[uiLang], items: items.filter((a) => a.pack?.subcategory === s.id) })),
    };
  });

  const mine: Shelf[] = [
    { id: "mine-images", group: "mine", label: t("My images"), items: userAssets.filter((a) => a.kind === "image"), parts: [], icon: <ImagePlus size={20} aria-hidden /> },
    { id: "mine-blocks", group: "mine", label: t("My blocks"), items: userAssets.filter((a) => a.kind === "block"), parts: [], icon: <Bookmark size={20} aria-hidden /> },
  ];
  return [...subjects, ...pictures, ...mine];
}

// The library (right panel). Click an item to add it, or drag it onto the page.
//  · on top, always: the search (everything, in English, French and Arabic);
//  · home: what was used last, then one tile per shelf: the subjects' diagrams and tables, the pictures, learning (shapes, numbers,
//    letters, time…), the teacher's own;
//  · a shelf: back, its name, its parts as chips, the card size; its items (a section per part);
//  · a search: the results of every shelf, a few per shelf until "Show all".
export default function LibraryPanel({ lang, subject, initialKind, userAssets, onUse, onImport, onDeleteUserAsset }: Props) {
  const t = useT();
  const { lang: uiLang } = useUi();
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  // The panel redraws with the page (every edit): the cards keep the same handlers, so they are not drawn again.
  const onUseRef = useRef(onUse);
  const onDeleteRef = useRef(onDeleteUserAsset);
  useEffect(() => {
    onUseRef.current = onUse;
    onDeleteRef.current = onDeleteUserAsset;
  });

  const [view, setView] = useState<string | null>(initialKind === "image" ? "mine-images" : initialKind === "block" ? "mine-blocks" : null);
  const [part, setPart] = useState("all");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<Size>(() => {
    const s = load(SIZE_KEY);
    return s === "s" || s === "l" ? s : "m";
  });
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const ids = JSON.parse(load(RECENT_KEY) ?? "[]");
      return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [opened, setOpened] = useState<Set<string>>(new Set()); // search groups shown whole

  const shelves = useMemo(() => buildShelves(userAssets, subject, t, uiLang), [userAssets, subject, t, uiLang]);
  const shelf = shelves.find((s) => s.id === view);
  const everything = useMemo(() => {
    const seen = new Map<string, Asset>();
    for (const s of shelves) for (const a of s.items) seen.set(a.id, a);
    return seen;
  }, [shelves]);
  const recent = recentIds.map((r) => everything.get(r)).filter((a): a is Asset => !!a);

  const q = query.trim();
  const found = (a: Asset) => matchesQuery(a.terms ?? searchTerms([a.name, t(a.name)]), q);
  // Each item once, in its first shelf (the exam's subject comes first).
  const results = useMemo(() => {
    if (!q) return [];
    const shown = new Set<string>();
    return shelves
      .map((s) => {
        const items = s.items.filter((a) => !shown.has(a.id) && found(a));
        items.forEach((a) => shown.add(a.id));
        return { shelf: s, items };
      })
      .filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `found` only reads q and t
  }, [q, shelves, t]);
  const resultCount = results.reduce((n, g) => n + g.items.length, 0);

  // A new page (another shelf, part or search) starts at its top.
  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [view, part, q]);

  const open = useCallback((shelfId: string | null) => {
    setView(shelfId);
    setPart("all");
    setQuery("");
  }, []);
  const changeSize = (s: Size) => {
    setSize(s);
    save(SIZE_KEY, s);
  };
  const remember = useCallback(
    (assetId: string) =>
      setRecentIds((ids) => {
        const next = [assetId, ...ids.filter((x) => x !== assetId)].slice(0, RECENT_MAX);
        save(RECENT_KEY, JSON.stringify(next));
        return next;
      }),
    [],
  );
  const use = useCallback(
    (a: Asset) => {
      remember(a.id);
      onUseRef.current(a);
    },
    [remember],
  );
  const clearSearch = () => {
    setQuery("");
    search.current?.focus();
  };

  // After a removal the keyboard stays in the list: on the card that took the place of the removed one.
  const remove = useCallback((assetId: string) => {
    const cards = [...(list.current?.querySelectorAll<HTMLElement>("[data-asset]") ?? [])];
    const i = cards.findIndex((c) => c.dataset.asset === assetId);
    const next = (cards[i + 1] ?? cards[i - 1])?.dataset.asset;
    onDeleteRef.current(assetId);
    requestAnimationFrame(() => {
      const card = next ? list.current?.querySelector<HTMLElement>(`[data-asset="${CSS.escape(next)}"] button`) : null;
      (card ?? list.current)?.focus();
    });
  }, []);

  const grid = (items: Asset[], s: Size = size) => (
    <ul className={GRID[s]}>
      {items.map((a) => (
        <AssetCard key={a.id} asset={a} lang={lang} size={s} onUse={use} onDrag={remember} onDelete={a.id.startsWith("user-") ? remove : undefined} />
      ))}
    </ul>
  );

  // ---- home: recent, then the shelves ----
  const home = () => (
    <>
      {recent.length > 0 && (
        <section aria-labelledby={`${id}-recent`} className="pt-3">
          <div className="mb-1.5 flex items-center">
            <GroupTitle id={`${id}-recent`}>{t("Recent")}</GroupTitle>
            <span className="ms-auto">
              <TextAction
                onClick={() => {
                  setRecentIds([]);
                  save(RECENT_KEY, "[]");
                }}
              >
                {t("Clear")}
              </TextAction>
            </span>
          </div>
          {grid(recent, "s")}
        </section>
      )}
      {(
        [
          ["subjects", t("Diagrams & tables")],
          ["pictures", t("Pictures")],
          ["learning", t("Learning & classroom")],
          ["mine", t("My library")],
        ] as const
      ).map(([group, title]) => (
        <section key={group} aria-labelledby={`${id}-${group}`} className="pt-4">
          <GroupTitle id={`${id}-${group}`} className="mb-1.5">
            {title}
          </GroupTitle>
          <ul className={GRID.m}>
            {shelves
              .filter((s) => s.group === group)
              .map((s) => (
                <ShelfTile key={s.id} shelf={s} lang={lang} onOpen={open} />
              ))}
          </ul>
        </section>
      ))}
    </>
  );

  // ---- a shelf ----
  const shelfView = (s: Shelf) => {
    const parts = s.parts.filter((p) => p.items.length);
    const chosen = parts.find((p) => p.id === part);
    if (!s.items.length) {
      return s.id === "mine-images" ? (
        <div className="pt-3">
          <EmptyState icon={<ImagePlus size={18} aria-hidden />} text={t("Your imported images are kept here.")}>
            <button type="button" onClick={onImport} className={mainButtonCls}>
              <Upload size={13} aria-hidden /> {t("Import an image")}
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="pt-3">
          <SaveBlockHelp />
        </div>
      );
    }
    if (chosen) return <div className="pt-2">{grid(chosen.items)}</div>;
    if (!parts.length) return <div className="pt-2">{grid(s.items)}</div>;
    return parts.map((p) => (
      <Section key={p.id} id={`${id}-part-${p.id}`} label={p.label} count={p.items.length}>
        {grid(p.items)}
      </Section>
    ));
  };

  // ---- a search: every shelf, a few results each ----
  const searchView = () =>
    results.length === 0 ? (
      <div className="pt-3">
        <EmptyState icon={<SearchX size={18} aria-hidden />} text={t("Nothing matches “{q}”.", { q })}>
          <button type="button" onClick={clearSearch} className={quietButtonCls}>
            {t("Clear search")}
          </button>
        </EmptyState>
      </div>
    ) : (
      results.map(({ shelf: s, items }) => {
        const whole = opened.has(s.id) || items.length <= PREVIEW[size] + 1;
        return (
          <Section
            key={s.id}
            id={`${id}-found-${s.id}`}
            label={s.label}
            count={items.length}
            action={
              items.length > PREVIEW[size] + 1 && (
                <TextAction
                  onClick={() =>
                    setOpened((o) => {
                      const next = new Set(o);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                >
                  {opened.has(s.id) ? t("Show fewer") : t("Show all {n}", { n: items.length })}
                </TextAction>
              )
            }
          >
            {grid(whole ? items : items.slice(0, PREVIEW[size]))}
          </Section>
        );
      })
    );

  const parts = shelf?.parts.filter((p) => p.items.length) ?? [];

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        // Escape: out of the search, then back to the shelves.
        if (e.key !== "Escape" || (!query && !view)) return;
        e.stopPropagation();
        if (query) setQuery("");
        else open(null);
      }}
    >
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="relative">
          <Search size={13} strokeWidth={2} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            ref={search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpened(new Set());
            }}
            placeholder={t("Search {n} items", { n: everything.size })}
            title={t("Search in English, French or Arabic")}
            aria-label={t("Search library...")}
            className={`${inputCls.replace("px-2 ", "")} h-7 ps-7 ${query ? "pe-7" : "pe-2"}`}
          />
          {query && (
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

        {/* Where we are: the results of a search, or a shelf (back, its name, its parts) */}
        {(q || shelf) && (
          <div className="flex min-h-7 items-center gap-1">
            {q ? (
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink" role="status">
                {t("{n} results", { n: resultCount })}
              </p>
            ) : (
              shelf && (
                <>
                  <button type="button" onClick={() => open(null)} title={t("Back to the library")} aria-label={t("Back to the library")} className="-ms-1.5 grid size-7 shrink-0 place-items-center rounded-[5px] text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
                    <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                  </button>
                  <h2 className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm font-semibold text-ink">
                    <span className="truncate">{shelf.label}</span>
                    <span className="text-xs font-normal text-faint tabular-nums">{shelf.items.length}</span>
                  </h2>
                  {shelf.id === "mine-images" && shelf.items.length > 0 && (
                    <button type="button" onClick={onImport} title={t("Import an image from your computer")} className="flex h-7 shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-xs font-medium text-accent-strong outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent">
                      <Upload size={12} strokeWidth={2} aria-hidden /> {t("Import")}
                    </button>
                  )}
                </>
              )
            )}
            <SizeToggle value={size} onChange={changeSize} />
          </div>
        )}
      </div>

      <div ref={list} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 outline-none">
        {/* (the parts of a shelf scroll with its items: a shelf with many topics keeps room for them) */}
        {!q && shelf && parts.length > 0 && (
          <div role="group" aria-label={shelf.label} className="flex flex-wrap gap-1 pt-3">
            {[{ id: "all", label: t("All"), items: shelf.items }, ...parts].map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                aria-pressed={part === p.id}
                onClick={() => {
                  setPart(p.id);
                }}
                className={`h-6 max-w-full truncate rounded-full px-2.5 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  part === p.id ? "bg-accent-soft text-accent-strong" : "bg-subtle text-muted hover:bg-hover hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {q ? searchView() : shelf ? shelfView(shelf) : home()}
      </div>
    </div>
  );
}

// Small (4 in a row, pictures only), medium (3), large (2).
function SizeToggle({ value, onChange }: { value: Size; onChange: (s: Size) => void }) {
  const t = useT();
  const sizes: { value: Size; label: string; icon: ReactNode }[] = [
    { value: "s", label: t("Small"), icon: <Grid3x3 size={13} aria-hidden /> },
    { value: "m", label: t("Medium"), icon: <Grid2x2 size={13} aria-hidden /> },
    { value: "l", label: t("Large"), icon: <Square size={13} aria-hidden /> },
  ];
  return (
    <div role="group" aria-label={t("Card size")} className="ms-auto flex shrink-0 rounded-[5px] bg-subtle p-0.5">
      {sizes.map((s) => (
        <button
          key={s.value}
          type="button"
          title={s.label}
          aria-label={s.label}
          aria-pressed={value === s.value}
          onClick={() => onChange(s.value)}
          className={`grid size-6 place-items-center rounded-[4px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${value === s.value ? "bg-surface text-ink ring-1 ring-line" : "text-muted hover:text-ink"}`}
        >
          {s.icon}
        </button>
      ))}
    </div>
  );
}

// "Recent", "Pictures", "My library"…: the titles of the home page.
function GroupTitle({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={`text-[11px] font-semibold tracking-wide text-faint uppercase ${className ?? ""}`}>
      {children}
    </h2>
  );
}

// A part of a shelf (or a shelf, in the search): its name, how many, an action at the end (the line stays in view while its items scroll).
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

// A card's picture, on a piece of paper (light in both looks, so the black lines of a drawing read as on the page), and its name.
function CardFace({ preview, name, count, small }: { preview: ReactNode; name?: string; count?: number; small?: boolean }) {
  return (
    <>
      <span data-paper="" className="relative block aspect-square w-full bg-subtle">
        <span className={`absolute inset-0 flex items-center justify-center ${small ? "p-1" : "p-2"}`}>{preview}</span>
      </span>
      {name && (
        <span className="block px-1.5 py-1">
          <span dir="auto" className="line-clamp-2 text-[11px] leading-[14px] font-medium text-ink [overflow-wrap:anywhere]">
            {name}
            {count !== undefined && <span className="ms-1 inline-block font-normal whitespace-nowrap text-faint tabular-nums [overflow-wrap:normal]">{count}</span>}
          </span>
        </span>
      )}
    </>
  );
}

// A shelf on the home page: its first item, its name and how many it has.
const ShelfTile = memo(function ShelfTile({ shelf, lang, onOpen }: { shelf: Shelf; lang: Lang; onOpen: (shelfId: string) => void }) {
  const t = useT();
  const cover = shelf.items[0];
  return (
    <li>
      <button type="button" onClick={() => onOpen(shelf.id)} title={t("{name}: {n} items", { name: shelf.label, n: shelf.items.length })} className={cardCls}>
        <CardFace
          preview={cover ? <AssetPreview asset={cover} lang={lang} /> : <span className="grid size-10 place-items-center rounded-full bg-surface text-muted">{shelf.icon}</span>}
          name={shelf.label}
          count={shelf.items.length}
        />
      </button>
    </li>
  );
});

const AssetCard = memo(function AssetCard({ asset, lang, size, onUse, onDrag, onDelete }: { asset: Asset; lang: Lang; size: Size; onUse: (a: Asset) => void; onDrag: (id: string) => void; onDelete?: (id: string) => void }) {
  const t = useT();
  const { lang: uiLang } = useUi();
  // Pictures have their names in each language; other built-in items have English names (translated); imported images keep their file name.
  const name = asset.names ? asset.names[uiLang] : asset.id.startsWith("user-") ? asset.name : t(asset.name);
  return (
    <li className="relative" data-asset={asset.id}>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "asset", assetId: asset.id }));
          e.dataTransfer.effectAllowed = "copy";
          onDrag(asset.id);
        }}
        onClick={() => onUse(asset)}
        title={t("{label} — click or drag onto the page", { label: name })}
        aria-label={name}
        className={cardCls}
      >
        {/* (small cards: the picture alone, its name in the tooltip) */}
        <CardFace preview={<AssetPreview asset={asset} lang={lang} />} name={size === "s" ? undefined : name} small={size === "s"} />
      </button>
      {onDelete && <DeleteButton name={name} onDelete={() => onDelete(asset.id)} />}
    </li>
  );
});

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

// The picture of a card, made once per item and exam language: figures are drawn from their settings, and a drawing becomes
// a data URL. (Shelves open and close, and the cards come back: the Sciences figures are not drawn again.)
const previews = new WeakMap<Asset, Map<Lang, string | undefined>>();
function previewSrc(asset: Asset, lang: Lang, savedPicture: string | undefined): string | undefined {
  let byLang = previews.get(asset);
  if (!byLang) previews.set(asset, (byLang = new Map()));
  if (byLang.has(lang)) return byLang.get(lang);
  const svg = (asset.figure ? renderFigure(asset.figure.id, asset.figure.params, lang)?.svg : undefined) ?? asset.svg;
  const src = svg ? svgUrl(svg) : (savedPicture ?? asset.src ?? asset.file);
  byLang.set(lang, src);
  return src;
}

function AssetPreview({ asset, lang }: { asset: Asset; lang: Lang }) {
  const t = useT();
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
  const src = previewSrc(asset, lang, savedPicture);
  // eslint-disable-next-line @next/next/no-img-element -- local data URL preview (or a picture file of the app)
  return <img src={src} alt="" loading="lazy" className="size-full object-contain" draggable={false} />;
}

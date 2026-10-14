"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/app/_lib/a4";
import { blockHeights, isQuestion } from "@/app/_lib/blocks";
import type { ExamDoc } from "@/app/_lib/types";
import { useUi } from "@/app/_lib/uiLang";
import { addVersion, deleteVersion, listVersions, type Version } from "@/app/_lib/versions";
import { PageBars } from "../workspace/PageStrip";

interface Props {
  current: ExamDoc;
  onRestore: (v: Version) => void;
  onClose: () => void;
}

const THUMB_W = 120;

// Every copy of the exam kept on this computer: automatic ones (every few minutes while you
// work, and before opening another exam) and the ones you name yourself. Restore any of them.
export default function VersionHistory({ current, onRestore, onClose }: Props) {
  const { t, lang } = useUi();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listVersions()
        .then(setVersions)
        .catch((e) => setError(String(e))),
    [],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const locale = lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-GB";
  const day = (time: number) => new Date(time).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const hour = (time: number) => new Date(time).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const saveNow = async () => {
    try {
      const v = await addVersion(current, "manual", name.trim());
      setName("");
      await reload();
      setSelectedId(v.id);
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async (id: string) => {
    await deleteVersion(id);
    if (selectedId === id) setSelectedId(null);
    await reload();
  };

  const selected = versions?.find((v) => v.id === selectedId) ?? null;
  const groups = useMemo(() => {
    const out: { day: string; items: Version[] }[] = [];
    for (const v of versions ?? []) {
      const d = day(v.time);
      if (out[out.length - 1]?.day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push(v);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, locale]);

  const kindLabel = (v: Version) =>
    v.kind === "manual" ? v.label || t("Saved version") : v.kind === "before" ? v.label || t("Before a change") : t("Automatic copy");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-6 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[min(640px,100%)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{t("Version history")}</h2>
            <p className="text-xs text-muted">{t("Copies are kept on this computer automatically every few minutes, and before opening another exam.")}</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")}>
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* List */}
          <div className="flex w-[340px] shrink-0 flex-col border-e border-line">
            <div className="flex gap-2 border-b border-line p-3">
              <input
                value={name}
                dir="auto"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void saveNow()}
                placeholder={t("Name (optional), e.g. “Before the review”")}
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-subtle px-2 text-xs outline-none focus:border-indigo-300 focus:bg-white"
              />
              <button onClick={() => void saveNow()} className="h-8 shrink-0 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-strong">
                {t("Save this version")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {error && <p className="p-3 text-xs text-red-600">{error}</p>}
              {!versions && !error && <p className="p-3 text-xs text-muted">{t("Loading…")}</p>}
              {versions?.length === 0 && <p className="p-6 text-center text-xs text-faint">{t("No versions yet. The first automatic copy is made a few minutes after you start editing.")}</p>}
              {groups.map((g) => (
                <section key={g.day} className="mb-2">
                  <h3 className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{g.day}</h3>
                  {g.items.map((v) => {
                    const q = v.doc.blocks.filter(isQuestion);
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedId(v.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors ${
                          v.id === selectedId ? "bg-accent-soft ring-1 ring-indigo-200" : "hover:bg-subtle"
                        }`}
                      >
                        <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-ink">{hour(v.time)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`size-1.5 shrink-0 rounded-full ${v.kind === "manual" ? "bg-indigo-500" : v.kind === "before" ? "bg-amber-500" : "bg-slate-300"}`} />
                            <span className="truncate text-xs font-medium text-ink" dir="auto">
                              {kindLabel(v)}
                            </span>
                          </span>
                          <span className="block truncate text-[11px] text-muted" dir="auto">
                            {v.doc.meta.title} · {t("{q} q. · {p} pts · {n} p.", { q: q.length, p: q.reduce((s, x) => s + x.points, 0), n: v.doc.pages.length })}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>

          {/* Preview of the chosen version */}
          <div className="flex min-w-0 flex-1 flex-col bg-subtle/60">
            {selected ? (
              <>
                <div className="flex-1 overflow-auto p-5">
                  <p className="mb-3 text-xs text-muted" dir="auto">
                    <b className="font-semibold text-ink">{kindLabel(selected)}</b> — {day(selected.time)}, {hour(selected.time)}
                  </p>
                  <VersionPages doc={selected.doc} />
                </div>
                <div className="flex justify-end gap-2 border-t border-line bg-white p-3">
                  <button onClick={() => void remove(selected.id)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    {t("Delete")}
                  </button>
                  <button onClick={() => onRestore(selected)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong">
                    {t("Restore this version")}
                  </button>
                </div>
              </>
            ) : (
              <p className="m-auto max-w-xs text-center text-xs text-faint">{t("Pick a version on the left to see it. Restoring keeps a copy of your current exam, and Undo (Ctrl+Z) brings it back.")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionPages({ doc }: { doc: ExamDoc }) {
  const heights = useMemo(() => blockHeights(doc), [doc]);
  const scale = THUMB_W / PAGE_WIDTH;
  return (
    <div className="flex flex-wrap gap-3" dir="ltr">
      {doc.pages.map((p, i) => (
        <div key={p.id} className="flex flex-col items-center gap-1">
          <div className="relative overflow-hidden rounded-[2px] bg-white shadow-sm ring-1 ring-black/10" style={{ width: THUMB_W, height: PAGE_HEIGHT * scale }}>
            <PageBars pageId={p.id} blocks={doc.blocks} heights={heights} scale={scale} />
          </div>
          <span className="text-[10px] text-muted">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

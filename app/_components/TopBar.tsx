"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SUBJECTS, type Subject } from "@/app/_lib/subjects";
import type { ViewMode } from "@/app/_lib/types";
import { UI_LANGS, useUi, type UiLang } from "@/app/_lib/uiLang";
import type { SaveState } from "@/app/_lib/useExam";
import { DownloadIcon, FileIcon, RedoIcon, UndoIcon } from "./icons";

interface Props {
  subject: Subject;
  onSubjectChange: (s: Subject) => void;
  title: string;
  onTitleChange: (t: string) => void;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onHistory: () => void;
  onPreview: () => void; // print preview, then export
  save: SaveState;
  uiLang: UiLang;
  onUiLang: (lang: UiLang) => void;
  busy: boolean; // exporting
}

// "Layers" icon used for the General tab.
const LayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 2L14 5.25 8 8.5 2 5.25z" />
    <path d="M2 8.25l6 3.25 6-3.25M2 11.25l6 3.25 6-3.25" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.25 5.4 8S6.2 3.65 8 1.75z" />
  </svg>
);

const iconBtn = "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent";

// Slim top bar: logo + file menu + title + save status, subject tabs, then language / undo /
// view mode / export.
export default function TopBar(props: Props) {
  const { subject, mode } = props;
  const { t } = useUi();

  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      {/* Logo + file menu + editable title + "Saved ✓" */}
      <div className="flex w-[300px] min-w-0 items-center gap-1.5">
        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-white">E</div>
        <Menu
          label={
            <span className="flex items-center gap-1">
              <FileIcon /> {t("File")}
            </span>
          }
          items={[
            { label: t("New from template…"), onClick: props.onNew },
            { label: t("Open exam…"), onClick: props.onOpen },
            { label: t("Save exam…"), hint: "Ctrl+S", onClick: props.onSave },
            { label: t("Version history…"), onClick: props.onHistory, separator: true },
            { label: t("Print preview & export…"), hint: "Ctrl+P", onClick: props.onPreview },
          ]}
        />
        <input
          value={props.title}
          onChange={(e) => props.onTitleChange(e.target.value)}
          dir="auto"
          className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[13px] text-muted outline-none hover:bg-subtle focus:bg-subtle focus:text-ink"
          title={t("Exam name")}
        />
        <SaveIndicator save={props.save} onClick={props.onHistory} />
      </div>

      {/* Subject tabs: the active one is filled with the accent color */}
      <nav className="flex items-center gap-0.5 rounded-md bg-subtle p-0.5 ring-1 ring-line">
        {SUBJECTS.map((s) => {
          const active = s === subject;
          const general = s === "General";
          return (
            <button
              key={s}
              onClick={() => props.onSubjectChange(s)}
              title={general ? t("General tools") : undefined}
              aria-label={general ? t("General tools") : undefined}
              className={`flex h-[26px] items-center rounded text-[13px] transition-colors ${general ? "px-2" : "px-3"} ${
                active ? "bg-accent font-semibold text-white shadow-sm" : "font-medium text-muted hover:bg-white hover:text-ink"
              }`}
            >
              {general ? <LayersIcon /> : t(s)}
            </button>
          );
        })}
      </nav>

      <div className="ms-auto flex items-center gap-2">
        {/* App language */}
        <Menu
          label={
            <span className="flex items-center gap-1 text-muted" title={t("App language")}>
              <GlobeIcon /> {UI_LANGS.find((l) => l.value === props.uiLang)?.value.toUpperCase()}
            </span>
          }
          items={UI_LANGS.map((l) => ({ label: l.label, checked: l.value === props.uiLang, onClick: () => props.onUiLang(l.value) }))}
          alignEnd
        />

        <div className="flex items-center">
          <button className={iconBtn} onClick={props.onUndo} disabled={!props.canUndo} title={`${t("Undo")} (Ctrl+Z)`}>
            <UndoIcon />
          </button>
          <button className={iconBtn} onClick={props.onRedo} disabled={!props.canRedo} title={`${t("Redo")} (Ctrl+Y)`}>
            <RedoIcon />
          </button>
        </div>

        {/* Exam / Correction view */}
        <div className="flex rounded-md bg-subtle p-0.5 ring-1 ring-line">
          {(["exam", "key"] as const).map((m) => (
            <button
              key={m}
              onClick={() => props.onModeChange(m)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                mode === m
                  ? m === "key"
                    ? "bg-emerald-600 font-semibold text-white shadow-sm"
                    : "bg-white font-semibold text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {m === "exam" ? t("Exam") : t("Correction")}
            </button>
          ))}
        </div>

        {/* Export: always through the print preview */}
        <button
          disabled={props.busy}
          onClick={props.onPreview}
          title={`${t("Print preview & export…")} (Ctrl+P)`}
          className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          <DownloadIcon /> {props.busy ? t("Exporting…") : t("Export PDF")}
        </button>
      </div>
    </header>
  );
}

// "Saving…" while the last change is being written, then "Saved ✓" (click: version history).
function SaveIndicator({ save, onClick }: { save: SaveState; onClick: () => void }) {
  const { t, lang } = useUi();
  const time = save.at ? new Date(save.at).toLocaleTimeString(lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  const look =
    save.status === "error"
      ? { text: t("Not saved!"), cls: "bg-red-50 text-red-700 ring-red-200", tip: t("This computer's storage is full. Save the exam to a file (Ctrl+S) to keep your work.") }
      : save.status === "saving"
        ? { text: t("Saving…"), cls: "text-faint ring-transparent", tip: t("Saving your changes on this computer…") }
        : {
            text: `${t("Saved")} ✓`,
            cls: "text-emerald-700 ring-transparent hover:bg-emerald-50",
            tip: time ? t("Saved on this computer at {time}. Click to see the version history.", { time }) : t("Everything is saved on this computer. Click to see the version history."),
          };
  return (
    <button onClick={onClick} title={look.tip} className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 transition-colors ${look.cls}`}>
      {look.text}
    </button>
  );
}

interface MenuItem {
  label: string;
  hint?: string;
  checked?: boolean;
  separator?: boolean; // line above this item
  onClick: () => void;
}

// A button that opens a small dropdown list.
function Menu({ label, items, alignEnd }: { label: ReactNode; items: MenuItem[]; alignEnd?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-7 items-center rounded-md px-2 text-[13px] font-medium text-ink transition-colors hover:bg-subtle">
        {label}
      </button>
      {open && (
        <div className={`absolute top-full z-30 mt-1.5 w-56 rounded-lg border border-line bg-white p-1 shadow-lg ${alignEnd ? "end-0" : "start-0"}`}>
          {items.map((it) => (
            <div key={it.label}>
              {it.separator && <div className="my-1 h-px bg-line" />}
              <button
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-start text-[13px] hover:bg-subtle ${it.checked ? "font-semibold text-indigo-600" : "text-ink"}`}
              >
                {it.label}
                {it.checked ? <span>✓</span> : it.hint && <span className="text-[11px] text-faint" dir="ltr">{it.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SUBJECTS, type Subject } from "@/app/_lib/subjects";
import type { ViewMode } from "@/app/_lib/types";
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
  onExport: (which: ViewMode | "both") => void;
  busy: boolean; // exporting
}

// "Layers" icon used for the General tab.
const LayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 2L14 5.25 8 8.5 2 5.25z" />
    <path d="M2 8.25l6 3.25 6-3.25M2 11.25l6 3.25 6-3.25" />
  </svg>
);

const iconBtn = "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent";

// Slim top bar: logo + file menu + title, subject tabs, then undo / view mode / export.
export default function TopBar(props: Props) {
  const { subject, mode } = props;

  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      {/* Logo + file menu + editable title */}
      <div className="flex w-[232px] min-w-0 items-center gap-1.5">
        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-white">E</div>
        <Menu
          label={
            <span className="flex items-center gap-1">
              <FileIcon /> File
            </span>
          }
          items={[
            { label: "New from template…", onClick: props.onNew },
            { label: "Open exam…", onClick: props.onOpen },
            { label: "Save exam…", hint: "Ctrl+S", onClick: props.onSave },
          ]}
        />
        <input
          value={props.title}
          onChange={(e) => props.onTitleChange(e.target.value)}
          dir="auto"
          className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[13px] text-muted outline-none hover:bg-subtle focus:bg-subtle focus:text-ink"
          title="Exam name"
        />
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
              title={general ? "General tools" : undefined}
              aria-label={general ? "General tools" : undefined}
              className={`flex h-[26px] items-center rounded text-[13px] transition-colors ${general ? "px-2" : "px-3"} ${
                active ? "bg-accent font-semibold text-white shadow-sm" : "font-medium text-muted hover:bg-white hover:text-ink"
              }`}
            >
              {general ? <LayersIcon /> : s}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center">
          <button className={iconBtn} onClick={props.onUndo} disabled={!props.canUndo} title="Undo (Ctrl+Z)">
            <UndoIcon />
          </button>
          <button className={iconBtn} onClick={props.onRedo} disabled={!props.canRedo} title="Redo (Ctrl+Y)">
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
              {m === "exam" ? "Exam" : "Correction"}
            </button>
          ))}
        </div>

        <Menu
          primary
          disabled={props.busy}
          label={
            <span className="flex items-center gap-1.5">
              <DownloadIcon /> {props.busy ? "Exporting…" : "Export PDF"}
            </span>
          }
          items={[
            { label: "Exam (student copy)", onClick: () => props.onExport("exam") },
            { label: "Correction sheet", onClick: () => props.onExport("key") },
            { label: "Both (2 files)", onClick: () => props.onExport("both") },
          ]}
          alignRight
        />
      </div>
    </header>
  );
}

interface MenuItem {
  label: string;
  hint?: string;
  onClick: () => void;
}

// A button that opens a small dropdown list.
function Menu({ label, items, primary, disabled, alignRight }: { label: ReactNode; items: MenuItem[]; primary?: boolean; disabled?: boolean; alignRight?: boolean }) {
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
      <button
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={
          primary
            ? "flex h-7 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-strong disabled:opacity-60"
            : "flex h-7 items-center rounded-md px-2 text-[13px] font-medium text-ink transition-colors hover:bg-subtle"
        }
      >
        {label}
      </button>
      {open && (
        <div className={`absolute top-full z-30 mt-1.5 w-52 rounded-lg border border-line bg-white p-1 shadow-lg ${alignRight ? "right-0" : "left-0"}`}>
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-subtle"
            >
              {it.label}
              {it.hint && <span className="text-[11px] text-faint">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

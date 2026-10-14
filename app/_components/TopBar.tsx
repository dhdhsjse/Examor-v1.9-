"use client";

// "General" = only the tools every subject shares.
export const SUBJECTS = ["General", "Math", "Physics", "Sciences", "Arabic", "French"] as const;
export type Subject = (typeof SUBJECTS)[number];

interface Props {
  subject: Subject;
  onSubjectChange: (s: Subject) => void;
}

// "Layers" icon used for the General tab.
const LayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 2L14 5.25 8 8.5 2 5.25z" />
    <path d="M2 8.25l6 3.25 6-3.25M2 11.25l6 3.25 6-3.25" />
  </svg>
);

// Slim top bar: logo + exam title, then the subject tabs.
export default function TopBar({ subject, onSubjectChange }: Props) {
  return (
    <header className="relative z-10 flex h-11 shrink-0 items-center gap-4 border-b border-line bg-surface px-3">
      {/* Logo + title */}
      <div className="flex w-[232px] items-center gap-2">
        <div className="grid size-6 place-items-center rounded-md bg-accent text-xs font-bold text-white">E</div>
        <span className="text-[13px] font-semibold text-ink">Exam Builder</span>
        <span className="text-faint">/</span>
        <span className="truncate text-[13px] text-muted">Untitled exam</span>
      </div>

      {/* Subject tabs: the active one is filled with the accent color */}
      <nav className="flex items-center gap-0.5 rounded-md bg-subtle p-0.5 ring-1 ring-line">
        {SUBJECTS.map((s) => {
          const active = s === subject;
          const general = s === "General";
          return (
            <button
              key={s}
              onClick={() => onSubjectChange(s)}
              title={general ? "General tools" : undefined}
              aria-label={general ? "General tools" : undefined}
              className={`flex h-[26px] items-center rounded text-[13px] transition-colors ${general ? "px-2" : "px-3"} ${
                active
                  ? "bg-accent font-semibold text-white shadow-sm"
                  : "font-medium text-muted hover:bg-white hover:text-ink"
              }`}
            >
              {general ? <LayersIcon /> : s}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

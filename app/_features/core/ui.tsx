import type { ReactNode } from 'react';

// Small presentational pieces shared by the top bar, the right panel and the overlays.

export const iconBtn =
  'grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';

export const LayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 2L14 5.25 8 8.5 2 5.25z" />
    <path d="M2 8.25l6 3.25 6-3.25M2 11.25l6 3.25 6-3.25" />
  </svg>
);

export const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.25 5.4 8S6.2 3.65 8 1.75z" />
  </svg>
);

export function SubjectTab({ text, title, icon, active, onClick }: { text: string; title?: string; icon?: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={icon ? title : undefined}
      className={`flex h-[26px] items-center rounded text-[13px] transition-colors ${icon ? 'px-2' : 'px-3'} ${
        active ? 'bg-accent font-semibold text-white shadow-sm' : 'font-medium text-muted hover:bg-white hover:text-ink'
      }`}
    >
      {icon ?? text}
    </button>
  );
}

export function ModeTab({ text, correction, active, onClick }: { text: string; correction: boolean; active: boolean; onClick: () => void }) {
  const on = correction ? 'bg-emerald-600 font-semibold text-white shadow-sm' : 'bg-white font-semibold text-ink shadow-sm';
  return (
    <button onClick={onClick} className={`rounded px-2.5 py-1 text-xs transition-colors ${active ? on : 'text-muted hover:text-ink'}`}>
      {text}
    </button>
  );
}

export function TabButton({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2 text-[13px] transition-colors ${active ? 'border-indigo-600 font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
    >
      {text}
    </button>
  );
}

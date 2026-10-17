// Small presentational pieces shared by the top bar, the right panel and the overlays.

export const iconBtn =
  'grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';

// An icon button that stays highlighted while what it controls is on (e.g. an open side panel).
export const toggleBtn = (on: boolean) =>
  `grid size-7 place-items-center rounded-md transition-colors ${on ? 'bg-accent-soft text-accent hover:bg-indigo-100' : 'text-muted hover:bg-subtle hover:text-ink'}`;

export function ModeTab({ text, correction, active, onClick }: { text: string; correction: boolean; active: boolean; onClick: () => void }) {
  const on = correction ? 'bg-emerald-600 font-semibold text-white shadow-sm' : 'bg-white font-semibold text-ink shadow-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded px-2.5 py-1 text-xs transition-colors ${active ? on : 'text-muted hover:text-ink'}`}
    >
      {text}
    </button>
  );
}

export function TabButton({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-mb-px whitespace-nowrap border-b-2 pb-2 text-[13px] transition-colors ${active ? 'border-indigo-600 font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
    >
      {text}
    </button>
  );
}

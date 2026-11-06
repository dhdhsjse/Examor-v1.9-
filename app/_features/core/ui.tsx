// Small presentational pieces shared by the top bar, the right panel and the overlays.
// Figma-like: 28px icon buttons, grey hover, a 16px icon (ui-icon, globals.css) and a visible focus ring.

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';

export const iconBtn =
  `ui-icon grid size-7 place-items-center rounded-[5px] text-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent ${focusRing}`;

// An icon button that stays pressed while what it controls is on (e.g. an open side panel): grey, like Figma's toggles.
export const toggleBtn = (on: boolean) =>
  `ui-icon grid size-7 place-items-center rounded-[5px] transition-colors ${focusRing} ${on ? 'bg-hover text-ink' : 'text-muted hover:bg-hover hover:text-ink'}`;

export function ModeTab({ text, correction, active, onClick }: { text: string; correction: boolean; active: boolean; onClick: () => void }) {
  const on = correction ? 'bg-emerald-600 font-semibold text-white' : 'bg-white font-semibold text-ink ring-1 ring-line';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-6 whitespace-nowrap rounded px-2.5 text-xs transition-colors ${focusRing} ${active ? on : 'text-muted hover:text-ink'}`}
    >
      {text}
    </button>
  );
}

// A panel tab (Properties / Library): plain text, the open one in ink with a line under it.
export function TabButton({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-mb-px h-9 whitespace-nowrap border-b-2 text-xs font-semibold transition-colors ${focusRing} ${active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
    >
      {text}
    </button>
  );
}

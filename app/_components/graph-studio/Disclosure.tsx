"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

// A section of a panel of the Graph Studio. Its title is always in sight, so the whole panel can be read at a glance; the content folds and unfolds with a
// slide that can be reversed at any moment (a grid row that grows from 0 to its height: pressing again mid-way turns it round from where it is).
// `count`: how many things are in it; `empty`: nothing is in it yet (no arrow, nothing to open — it opens by itself when something comes in);
// `reveal`: what is selected in it (a new selection opens the section, so what was picked on the paper is never hidden under a closed title).
export default function Disclosure({
  title,
  testId,
  defaultOpen = true,
  count,
  empty = false,
  reveal,
  children,
}: {
  title: string;
  testId: string;
  defaultOpen?: boolean;
  count?: number;
  empty?: boolean;
  reveal?: string | null;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [was, setWas] = useState({ empty, reveal });
  // (the first thing that comes in, or a new selection, opens the section)
  if (was.empty !== empty || was.reveal !== reveal) {
    setWas({ empty, reveal });
    if ((was.empty && !empty) || (reveal && reveal !== was.reveal)) setOpen(true);
  }
  const shown = open && !empty;
  const slide = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

  return (
    <section data-testid={testId} aria-label={title} className="border-b border-line/70 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={empty ? undefined : shown}
          aria-controls={id}
          disabled={empty}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-full items-center gap-2 px-4 text-start outline-none transition-colors hover:bg-subtle/70 focus-visible:bg-subtle disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className={`text-[13px] font-semibold tracking-[-0.01em] ${empty ? "text-muted" : "text-ink"}`}>{title}</span>
          {!!count && <span className="rounded-full bg-subtle px-1.5 text-[11px] font-medium text-muted tabular-nums">{count}</span>}
          {!empty && <ChevronDown size={15} strokeWidth={2} aria-hidden className={`ms-auto text-muted transition-transform ${slide} ${shown ? "" : "-rotate-90 rtl:rotate-90"}`} />}
        </button>
      </h3>
      <div id={id} inert={!shown} className={`grid transition-[grid-template-rows,opacity] ${slide} ${shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 px-4 pt-0.5 pb-3.5">{children}</div>
        </div>
      </div>
    </section>
  );
}

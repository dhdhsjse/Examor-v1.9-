"use client";

import { Info } from "lucide-react";
import { useId, useRef, useState } from "react";

const WIDTH = 240;

// A small (i) that shows a short explanation on hover, keyboard focus or click. The bubble is
// placed on the screen (fixed), so a scrolling panel never cuts it.
export default function InfoTip({ text, label }: { text: string; label: string }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; above: boolean } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
    const above = r.bottom + 120 > window.innerHeight;
    setAt({ left, top: above ? r.top - 6 : r.bottom + 6, above });
  };
  const hide = () => setAt(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-describedby={id}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (at ? hide() : show())}
        onKeyDown={(e) => e.key === "Escape" && hide()}
        className="grid size-4 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info size={13} strokeWidth={2} aria-hidden />
      </button>
      <div
        id={id}
        role="tooltip"
        hidden={!at}
        className="pointer-events-none fixed z-50 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] leading-snug font-normal text-white shadow-lg"
        style={{ width: WIDTH, left: at?.left, top: at?.top, transform: at?.above ? "translateY(-100%)" : undefined }}
      >
        {text}
      </div>
    </>
  );
}

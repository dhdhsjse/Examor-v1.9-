"use client";

import { useEffect, useState } from "react";
import type { Feature } from "@/app/_features/core/types";
import { closeWindow, minimizeWindow, toggleMaximizeWindow, watchMaximized } from "@/app/_lib/desktopWindow";
import type { T } from "@/app/_lib/uiLang";

// Windows-style caption buttons, drawn at the end of the top bar (the window has no native frame).
const btn = "grid h-full w-[46px] place-items-center text-ink/80 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const icon = { width: 10, height: 10, viewBox: "0 0 10 10", fill: "none", stroke: "currentColor", strokeWidth: 1, "aria-hidden": true };

function WindowControls({ t }: { t: T }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => watchMaximized(setMaximized), []);
  const maxLabel = maximized ? t("Restore down") : t("Maximize");

  return (
    <div className="flex h-full">
      <button type="button" onClick={minimizeWindow} title={t("Minimize")} aria-label={t("Minimize")} className={`${btn} hover:bg-black/5 active:bg-black/10`}>
        <svg {...icon}>
          <path d="M0 5.5h10" />
        </svg>
      </button>
      <button type="button" onClick={toggleMaximizeWindow} title={maxLabel} aria-label={maxLabel} className={`${btn} hover:bg-black/5 active:bg-black/10`}>
        {maximized ? (
          <svg {...icon}>
            <path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" />
          </svg>
        ) : (
          <svg {...icon}>
            <rect x=".5" y=".5" width="9" height="9" />
          </svg>
        )}
      </button>
      <button type="button" onClick={closeWindow} title={t("Close")} aria-label={t("Close")} className={`${btn} hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/85 active:text-white`}>
        <svg {...icon}>
          <path d="M.5.5l9 9M9.5.5l-9 9" />
        </svg>
      </button>
    </div>
  );
}

// Minimize / maximize / close. Only in the desktop app (its group is hidden in a browser).
export const windowControlsPanel: Feature = {
  id: "panel.window-controls",
  kind: "panel",
  label: "Window controls",
  render: ({ ctx }) => <WindowControls t={ctx.t} />,
};

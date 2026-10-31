"use client";

import { useEffect, useState } from "react";
import { INK_DEFAULTS, INK_SIZES, INK_TOOLS, type InkSettings, type InkTool, type Smoothing } from "./engine";

const STORE = "exam-builder:ink-tools";

type Saved = { tool: InkTool; settings: Record<InkTool, InkSettings> };

export type InkTools = {
  /** The tool of the three in hand */
  tool: InkTool;
  /** How each of them draws (its color, size and smoothing are its own) */
  settings: Record<InkTool, InkSettings>;
  pick: (tool: InkTool) => void;
  /** Changes how the tool in hand draws */
  set: (patch: Partial<InkSettings>) => void;
  /** The next tool (the P shortcut) */
  cycle: () => void;
};

const valid = (tool: unknown): tool is InkTool => INK_TOOLS.includes(tool as InkTool);

function load(): Saved {
  const fresh: Saved = { tool: "pencil", settings: { ...INK_DEFAULTS } };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<Saved> | null;
    if (!raw) return fresh;
    const settings = { ...INK_DEFAULTS };
    for (const t of INK_TOOLS) {
      const s = raw.settings?.[t];
      if (!s) continue;
      const [lo, hi] = INK_SIZES[t];
      settings[t] = {
        color: typeof s.color === "string" ? s.color : INK_DEFAULTS[t].color,
        size: typeof s.size === "number" ? Math.min(hi, Math.max(lo, s.size)) : INK_DEFAULTS[t].size,
        smoothing: ([0, 1, 2, 3] as const).includes(s.smoothing as Smoothing) ? s.smoothing : INK_DEFAULTS[t].smoothing,
      };
    }
    return { tool: valid(raw.tool) ? raw.tool : "pencil", settings };
  } catch {
    return fresh;
  }
}

// The Draw tool of the page: which of its brush, pencil and highlighter is in hand and how each draws, kept between sessions.
export function useInkTools(): InkTools {
  const [state, setState] = useState<Saved>({ tool: "pencil", settings: INK_DEFAULTS });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // (read after the first render: the server has no storage)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch {
      /* (full or blocked: the tools still work, they are just not kept) */
    }
  }, [state, ready]);
  return {
    tool: state.tool,
    settings: state.settings,
    pick: (tool) => setState((s) => ({ ...s, tool })),
    set: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, [s.tool]: { ...s.settings[s.tool], ...patch } } })),
    cycle: () => setState((s) => ({ ...s, tool: INK_TOOLS[(INK_TOOLS.indexOf(s.tool) + 1) % INK_TOOLS.length] })),
  };
}

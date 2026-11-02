"use client";

import { useEffect, useState } from "react";
import { ERASER_DEFAULTS, ERASER_MODES, ERASER_SIZES, type EraserMode, type EraserSettings } from "./eraser";

const STORE = "exam-builder:eraser";

export type EraserTool = EraserSettings & {
  setMode: (mode: EraserMode) => void;
  setSize: (size: number) => void;
};

function load(): EraserSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<EraserSettings> | null;
    const [lo, hi] = ERASER_SIZES;
    return {
      mode: ERASER_MODES.includes(raw?.mode as EraserMode) ? (raw?.mode as EraserMode) : ERASER_DEFAULTS.mode,
      size: typeof raw?.size === "number" ? Math.min(hi, Math.max(lo, Math.round(raw.size))) : ERASER_DEFAULTS.size,
    };
  } catch {
    return ERASER_DEFAULTS;
  }
}

// The eraser of the tool bars: how it rubs (parts of the drawings, or whole drawings and shapes) and how big it is, kept between sessions.
export function useEraserTool(): EraserTool {
  const [state, setState] = useState<EraserSettings>(ERASER_DEFAULTS);
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
      /* (full or blocked: the eraser still works, it is just not kept) */
    }
  }, [state, ready]);
  const [lo, hi] = ERASER_SIZES;
  return {
    ...state,
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setSize: (size) => setState((s) => ({ ...s, size: Math.min(hi, Math.max(lo, Math.round(size))) })),
  };
}

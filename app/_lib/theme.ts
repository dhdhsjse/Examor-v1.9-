import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./themeBoot";

// The look of the app: light, dark, or the system's. Kept in the browser (not in the exam: it is the person's, like the app language).
// `data-theme` on <html> carries the result; app/layout.tsx sets it before the first paint so the page never flashes the other look.
// The pages themselves (the paper) are white in both.
export type ThemeMode = "light" | "dark" | "system";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

const isMode = (v: unknown): v is ThemeMode => v === "light" || v === "dark" || v === "system";

export function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isMode(v) ? v : "system";
  } catch {
    return "system";
  }
}

const prefersDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
export const resolveTheme = (mode: ThemeMode): "light" | "dark" => (mode === "system" ? (prefersDark() ? "dark" : "light") : mode);

/** Puts the look on the page */
export function applyTheme(mode: ThemeMode = loadThemeMode()) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(mode);
  root.dataset.themeMode = mode;
}

const listeners = new Set<() => void>();
export function saveThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* (private window: the look still changes, for this visit) */
  }
  document.documentElement.dataset.themeMode = mode;
  applyTheme(mode);
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // (the system's own look changes while the mode is "system")
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const follow = () => {
    if (loadThemeMode() === "system") {
      applyTheme("system");
      onChange();
    }
  };
  mq?.addEventListener("change", follow);
  return () => {
    listeners.delete(onChange);
    mq?.removeEventListener("change", follow);
  };
}

/** The mode in use, and how to change it */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const mode = useSyncExternalStore(subscribe, loadThemeMode, () => "system" as ThemeMode);
  return [mode, saveThemeMode];
}

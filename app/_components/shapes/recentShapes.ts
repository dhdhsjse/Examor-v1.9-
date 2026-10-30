"use client";

import { useSyncExternalStore } from "react";
import { hasShape, pushRecent, RECENT_LIMIT } from "@/app/_lib/shapes";

// The shapes used lately (the first row of the gallery), remembered in the browser: shared by the page editor and every Studio.
const KEY = "examBuilder.recentShapes";
const NONE: string[] = [];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string" && hasShape(s)).slice(0, RECENT_LIMIT) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function rememberShape(id: string) {
  cache = pushRecent(read(), id);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // (no storage: the list lives until the page is closed)
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useRecentShapes = () => useSyncExternalStore(subscribe, read, () => NONE);

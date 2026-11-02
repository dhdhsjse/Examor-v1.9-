"use client";

import { useSyncExternalStore } from "react";
import { familyDef } from "@/app/_lib/chart/catalog";
import { lookOf, pushRecentKind, pushTemplate, readRecentKinds, readTemplates, type ChartTemplate, type KindRef } from "@/app/_lib/chart/templates";
import type { ChartConfig } from "@/app/_lib/chart/types";

// What the teacher's browser remembers for Insert Chart: the kinds picked lately and the templates saved by name. Shared by every Studio that opens.
const RECENT_KEY = "examBuilder.recentCharts";
const TEMPLATES_KEY = "examBuilder.chartTemplates";
const NO_KINDS: KindRef[] = [];
const NO_TEMPLATES: ChartTemplate[] = [];
const listeners = new Set<() => void>();
let recent: KindRef[] | null = null;
let templates: ChartTemplate[] | null = null;

function load(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // (no storage, or it is full: the list lives until the page is closed)
  }
}

const exists = (k: KindRef) => familyDef(k.family).id === k.family && familyDef(k.family).variants.some((v) => v.id === k.variant);

const readRecent = () => (recent ??= readRecentKinds(load(RECENT_KEY), exists));
const readSaved = () => (templates ??= readTemplates(load(TEMPLATES_KEY)));

export function rememberKind(kind: KindRef) {
  recent = pushRecentKind(readRecent(), kind);
  save(RECENT_KEY, recent);
  listeners.forEach((l) => l());
}

/** Keep the look of a chart under a name (a name already taken is replaced) */
export function saveTemplate(name: string, config: ChartConfig) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  templates = pushTemplate(readSaved(), { id, name: name.trim(), look: lookOf(config) });
  save(TEMPLATES_KEY, templates);
  listeners.forEach((l) => l());
}

export function deleteTemplate(id: string) {
  templates = readSaved().filter((x) => x.id !== id);
  save(TEMPLATES_KEY, templates);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useRecentKinds = () => useSyncExternalStore(subscribe, readRecent, () => NO_KINDS);
export const useChartTemplates = () => useSyncExternalStore(subscribe, readSaved, () => NO_TEMPLATES);

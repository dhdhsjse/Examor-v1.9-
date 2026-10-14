"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { AR, FR } from "./uiStrings";

// Language of the app itself (menus, panels, buttons). The exam paper has its own language.
export type UiLang = "en" | "fr" | "ar";

export const UI_LANGS: { value: UiLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

const STORAGE_KEY = "examBuilder.uiLang";

type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

// The English text is the key: missing translations fall back to English.
// "{name}" in the text is replaced by vars.name.
export function translate(lang: UiLang, text: string, vars?: Vars): string {
  const out = (lang === "fr" ? FR[text] : lang === "ar" ? AR[text] : undefined) ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : out;
}

export function loadUiLang(): UiLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr" || saved === "ar") return saved;
    const nav = navigator.language.slice(0, 2);
    return nav === "fr" || nav === "ar" ? nav : "en";
  } catch {
    return "en";
  }
}

export function saveUiLang(lang: UiLang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

interface UiValue {
  lang: UiLang;
  rtl: boolean;
  t: T;
}

const UiContext = createContext<UiValue>({ lang: "en", rtl: false, t: (s, v) => translate("en", s, v) });

export function UiProvider({ lang, children }: { lang: UiLang; children: ReactNode }) {
  const value = useMemo<UiValue>(() => ({ lang, rtl: lang === "ar", t: (s, v) => translate(lang, s, v) }), [lang]);
  return <UiContext value={value}>{children}</UiContext>;
}

// `t("Save exam…")` → the text in the app's language.
export const useUi = () => useContext(UiContext);
export const useT = () => useContext(UiContext).t;

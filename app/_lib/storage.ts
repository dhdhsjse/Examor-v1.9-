import type { Asset } from "./library";
import type { ExamDoc } from "./types";

// True when running inside the Tauri desktop window (not a normal browser).
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface FileFilter {
  name: string;
  extensions: string[];
}

// Save bytes or text: a "Save as" window in the desktop app, a download in the browser.
// Returns false if the user cancelled.
export async function saveFile(data: Uint8Array | string, fileName: string, filter: FileFilter): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: fileName, filters: [filter] });
    if (!path) return false;
    const fs = await import("@tauri-apps/plugin-fs");
    if (typeof data === "string") await fs.writeTextFile(path, data);
    else await fs.writeFile(path, data);
    return true;
  }
  const blob = new Blob([typeof data === "string" ? data : new Uint8Array(data)]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

// Let the user pick a file (works in Tauri and in the browser).
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ---- Autosave + user library, in localStorage (can fail when full: ignore) ----

const DOC_KEY = "examBuilder.doc";
const ASSETS_KEY = "examBuilder.userAssets";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadAutosave = () => {
  const doc = read<ExamDoc>(DOC_KEY);
  return doc?.version === 1 ? doc : null;
};
export const saveAutosave = (doc: ExamDoc) => write(DOC_KEY, doc);
export const loadUserAssets = () => read<Asset[]>(ASSETS_KEY) ?? [];
export const saveUserAssets = (assets: Asset[]) => write(ASSETS_KEY, assets);

// Check that an opened file looks like an exam.
export function parseExamFile(text: string): ExamDoc | null {
  try {
    const doc = JSON.parse(text) as ExamDoc;
    return doc.version === 1 && Array.isArray(doc.pages) && Array.isArray(doc.blocks) ? doc : null;
  } catch {
    return null;
  }
}

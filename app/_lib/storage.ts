import type { Asset } from "./library";
import { keepStorage, readJson, writeJson } from "./appStore";
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

// ---- The exam's own file ----
// In the desktop app the file an exam was opened from or saved to is known (its path): Ctrl+S writes it again, like Word. In a
// browser a save is a download (no path), and opening reads a picked file.

const EXAM_FILTER: FileFilter = { name: "Exam", extensions: ["json"] };
export const fileNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Asks where (desktop) and writes the exam there. The path written to ("" in a browser: downloaded), or null when cancelled. */
export async function saveExamAs(text: string, suggested: string): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: suggested, filters: [EXAM_FILTER] });
    if (!path) return null;
    await writeExamAt(path, text);
    return path;
  }
  return (await saveFile(text, suggested, EXAM_FILTER)) ? "" : null;
}

/** Writes the exam over its file (desktop). (Straight in it: the app may write only the file the teacher picked, not one beside it;
 *  the autosave keeps the exam meanwhile.) */
export async function writeExamAt(path: string, text: string): Promise<void> {
  const fs = await import("@tauri-apps/plugin-fs");
  await fs.writeTextFile(path, text);
}

/** A picked exam file: its text, and its path (null in a browser). Null when cancelled. */
export async function openExamFile(): Promise<{ text: string; path: string | null; name: string } | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false, directory: false, filters: [EXAM_FILTER] });
    if (typeof path !== "string") return null;
    const fs = await import("@tauri-apps/plugin-fs");
    return { text: await fs.readTextFile(path), path, name: fileNameOf(path) };
  }
  const file = await pickFile(".json,application/json");
  return file ? { text: await file.text(), path: null, name: file.name } : null;
}

// ---- Autosave + user library: the app's own files (appStore) ----

const AUTOSAVE = "autosave/current.exam.json";
const ASSETS = "library/my-items.json";
// (where they were before: localStorage, about 5 MB for everything; moved once to the files, then removed from it)
const OLD_DOC_KEY = "examBuilder.doc";
const OLD_ASSETS_KEY = "examBuilder.userAssets";

function oldValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// The value of a file, or the one left in localStorage (moved to the file then, and taken out of localStorage once it is there)
async function readMoved<T>(name: string, oldKey: string): Promise<T | null> {
  const value = await readJson<T>(name);
  if (value !== null) return value;
  const old = oldValue<T>(oldKey);
  if (old === null) return null;
  try {
    await writeJson(name, old);
    localStorage.removeItem(oldKey);
  } catch {
    // (stays in localStorage: moved next time)
  }
  return old;
}

export async function loadAutosave(): Promise<ExamDoc | null> {
  const doc = await readMoved<ExamDoc>(AUTOSAVE, OLD_DOC_KEY);
  return doc?.version === 1 && Array.isArray(doc.pages) && Array.isArray(doc.blocks) ? doc : null;
}
/** Throws when it could not be written. */
export const saveAutosave = (doc: ExamDoc) => writeJson(AUTOSAVE, doc);
export const loadUserAssets = async () => (await readMoved<Asset[]>(ASSETS, OLD_ASSETS_KEY)) ?? [];
/** False when it could not be written. */
export const saveUserAssets = (assets: Asset[]) => writeJson(ASSETS, assets).then(() => true, () => false);

// What the app opens with: the exam being worked on (null: none yet) and the library. Never fails.
export async function loadStart(): Promise<{ doc: ExamDoc | null; assets: Asset[] }> {
  keepStorage();
  const [doc, assets] = await Promise.all([loadAutosave().catch(() => null), loadUserAssets().catch(() => [])]);
  return { doc, assets };
}

// Check that an opened file looks like an exam.
export function parseExamFile(text: string): ExamDoc | null {
  try {
    const doc = JSON.parse(text) as ExamDoc;
    return doc.version === 1 && Array.isArray(doc.pages) && Array.isArray(doc.blocks) ? doc : null;
  } catch {
    return null;
  }
}

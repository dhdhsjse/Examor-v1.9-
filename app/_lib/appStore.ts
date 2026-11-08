// Where the app keeps its own data (the exam being worked on, the library, the version history), as named JSON files.
// In the desktop app: real files in the app's folder (%APPDATA%\com.examor.app on Windows), no size limit. Each one is written beside
// itself first and then put in its place, the copy before kept as ".bak": a crash or a power cut while writing never leaves a broken file.
// In a plain browser (development): IndexedDB, which has room for exams with pictures.

const isDesktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---- Browser: IndexedDB ----

const DB_NAME = "examBuilder";
const KV = "files";
export const OLD_VERSIONS = "versions"; // (where the version history was before: read once to move it, see versions.ts)

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OLD_VERSIONS)) db.createObjectStore(OLD_VERSIONS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idb<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Storage full"));
    });
  } finally {
    db.close();
  }
}

// ---- Desktop: files ----

const fs = () => import("@tauri-apps/plugin-fs");
const made = new Set<string>();

async function ensureDir(name: string) {
  const dir = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
  if (!dir || made.has(dir)) return;
  const { mkdir, BaseDirectory } = await fs();
  await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  made.add(dir);
}

async function readFileJson<T>(name: string): Promise<T | null> {
  const { readFile, exists, BaseDirectory } = await fs();
  const baseDir = BaseDirectory.AppData;
  for (const path of [name, `${name}.bak`]) {
    try {
      if (!(await exists(path, { baseDir }))) continue;
      return JSON.parse(new TextDecoder().decode(await readFile(path, { baseDir }))) as T;
    } catch {
      // (a broken file: the copy before it)
    }
  }
  return null;
}

async function writeFileJson(name: string, value: unknown, backup: boolean) {
  const { writeFile, rename, exists, BaseDirectory } = await fs();
  const baseDir = BaseDirectory.AppData;
  const both = { oldPathBaseDir: baseDir, newPathBaseDir: baseDir };
  await ensureDir(name);
  await writeFile(`${name}.tmp`, new TextEncoder().encode(JSON.stringify(value)), { baseDir });
  if (backup && (await exists(name, { baseDir }))) await rename(name, `${name}.bak`, both);
  await rename(`${name}.tmp`, name, both);
}

async function removeFile(name: string) {
  const { remove, exists, BaseDirectory } = await fs();
  const baseDir = BaseDirectory.AppData;
  for (const path of [name, `${name}.bak`]) if (await exists(path, { baseDir })) await remove(path, { baseDir });
}

// ---- The same for both ----

/** The file's content, or null when there is none (or it can't be read). */
export async function readJson<T>(name: string): Promise<T | null> {
  try {
    if (isDesktop()) return await readFileJson<T>(name);
    return ((await idb<T>(KV, "readonly", (s) => s.get(name) as IDBRequest<T>)) ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Writes it, or throws (disk full, no right to write…). `backup`: keep the copy before as ".bak" (desktop). */
export async function writeJson(name: string, value: unknown, { backup = true } = {}): Promise<void> {
  if (isDesktop()) return writeFileJson(name, value, backup);
  await idb(KV, "readwrite", (s) => s.put(value, name));
}

export async function removeJson(name: string): Promise<void> {
  if (isDesktop()) return removeFile(name);
  await idb(KV, "readwrite", (s) => s.delete(name));
}

// Ask the browser to keep this data when the disk runs low (the desktop app's files are kept anyway).
export function keepStorage() {
  if (!isDesktop()) void navigator.storage?.persist?.().catch(() => false);
}

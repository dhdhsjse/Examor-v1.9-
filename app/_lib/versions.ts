import { newId } from "./id";
import type { ExamDoc } from "./types";

// Version history: copies of the exam kept on this computer (IndexedDB: much more room than
// localStorage, so exams with images fit). Newest first.

export type VersionKind = "auto" | "manual" | "before";

export interface Version {
  id: string;
  time: number;
  kind: VersionKind;
  label: string; // the teacher's name for it, or what happened ("Before opening …")
  doc: ExamDoc;
}

const DB_NAME = "examBuilder";
const STORE = "versions";
const MAX_AUTO = 40; // older automatic copies are removed

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listVersions(): Promise<Version[]> {
  const all = await run("readonly", (s) => s.getAll() as IDBRequest<Version[]>);
  return all.sort((a, b) => b.time - a.time);
}

export async function addVersion(doc: ExamDoc, kind: VersionKind, label = ""): Promise<Version> {
  const v: Version = { id: newId(), time: Date.now(), kind, label, doc: structuredClone(doc) };
  await run("readwrite", (s) => s.put(v));
  if (kind === "auto") {
    const autos = (await listVersions()).filter((x) => x.kind === "auto");
    for (const old of autos.slice(MAX_AUTO)) await deleteVersion(old.id);
  }
  return v;
}

export const deleteVersion = (id: string) => run("readwrite", (s) => s.delete(id)).then(() => undefined);

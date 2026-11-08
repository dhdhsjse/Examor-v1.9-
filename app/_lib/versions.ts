import { idb, OLD_VERSIONS, readJson, removeJson, writeJson } from "./appStore";
import { isQuestion } from "./blocks";
import { newId } from "./id";
import type { ExamDoc } from "./types";

// Version history: copies of the exam kept with the app's own files (appStore): an index of them (what the list shows), and each
// copy in its own file, read only when it is looked at. Newest first.

export type VersionKind = "auto" | "manual" | "before";

export interface VersionInfo {
  id: string;
  time: number;
  kind: VersionKind;
  label: string; // the teacher's name for it, or what happened ("Before opening …")
  title: string; // (of the exam then)
  questions: number;
  points: number;
  pages: number;
}
export interface Version extends VersionInfo {
  doc: ExamDoc;
}

const INDEX = "versions/index.json";
const docFile = (id: string) => `versions/${id}.exam.json`;
const MAX_AUTO = 40; // older automatic copies are removed

export function versionInfo(doc: ExamDoc, v: Pick<VersionInfo, "id" | "time" | "kind" | "label">): VersionInfo {
  const q = doc.blocks.filter(isQuestion);
  return { ...v, title: doc.meta.title, questions: q.length, points: q.reduce((s, x) => s + x.points, 0), pages: doc.pages.length };
}

// The index, read once (with the copies kept where they were before, moved here the first time). Changes go one after the other.
let index: Promise<VersionInfo[]> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
};

async function moveOld(): Promise<VersionInfo[]> {
  let old: Version[] = [];
  try {
    old = ((await idb<Version[]>(OLD_VERSIONS, "readonly", (s) => s.getAll() as IDBRequest<Version[]>)) ?? []).filter((v) => v?.doc);
  } catch {
    return [];
  }
  const list: VersionInfo[] = [];
  for (const v of old) {
    await writeJson(docFile(v.id), v.doc, { backup: false });
    list.push(versionInfo(v.doc, v));
  }
  list.sort((a, b) => b.time - a.time);
  await writeJson(INDEX, list);
  await idb(OLD_VERSIONS, "readwrite", (s) => s.clear()).catch(() => undefined);
  return list;
}

const loadIndex = () =>
  (index ??= (async () => {
    const list = await readJson<VersionInfo[]>(INDEX);
    if (list) return list;
    try {
      return await moveOld();
    } catch {
      return [];
    }
  })());

export async function listVersions(): Promise<VersionInfo[]> {
  return [...(await loadIndex())].sort((a, b) => b.time - a.time);
}

export async function loadVersion(id: string): Promise<Version> {
  const info = (await loadIndex()).find((v) => v.id === id);
  const doc = await readJson<ExamDoc>(docFile(id));
  if (!info || !doc) throw new Error("This version can't be read");
  return { ...info, doc };
}

export function addVersion(doc: ExamDoc, kind: VersionKind, label = ""): Promise<VersionInfo> {
  return inTurn(async () => {
    const v = versionInfo(doc, { id: newId(), time: Date.now(), kind, label });
    await writeJson(docFile(v.id), doc, { backup: false });
    let list = [v, ...(await loadIndex())];
    const extra = list.filter((x) => x.kind === "auto").slice(MAX_AUTO);
    list = list.filter((x) => !extra.includes(x));
    await writeJson(INDEX, list);
    index = Promise.resolve(list);
    for (const x of extra) await removeJson(docFile(x.id)).catch(() => undefined);
    return v;
  });
}

export function deleteVersion(id: string): Promise<void> {
  return inTurn(async () => {
    const list = (await loadIndex()).filter((v) => v.id !== id);
    await writeJson(INDEX, list);
    index = Promise.resolve(list);
    await removeJson(docFile(id)).catch(() => undefined);
  });
}

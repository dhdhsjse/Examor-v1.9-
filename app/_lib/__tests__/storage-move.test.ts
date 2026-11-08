import { beforeEach, describe, expect, it, vi } from "vitest";

// The app's files, kept in memory here (a write can be made to fail)
const files = new Map<string, unknown>();
let failWrites = false;
vi.mock("../appStore", () => ({
  readJson: async (name: string) => (files.has(name) ? structuredClone(files.get(name)) : null),
  writeJson: async (name: string, value: unknown) => {
    if (failWrites) throw new Error("disk full");
    files.set(name, structuredClone(value));
  },
  keepStorage: () => {},
}));

const { loadAutosave, loadUserAssets, saveAutosave } = await import("../storage");

const exam = { version: 1, meta: { title: "Contrôle" }, pages: [{ id: "p1" }], blocks: [] };
const local = new Map<string, string>();

beforeEach(() => {
  files.clear();
  local.clear();
  failWrites = false;
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k),
  });
});

describe("the exam and the library kept in the app's files", () => {
  it("moves an exam left in localStorage to the file, then takes it out of localStorage", async () => {
    local.set("examBuilder.doc", JSON.stringify(exam));
    expect((await loadAutosave())?.meta.title).toBe("Contrôle");
    expect(files.get("autosave/current.exam.json")).toEqual(exam);
    expect(local.has("examBuilder.doc")).toBe(false);
  });

  it("keeps it in localStorage when the file can't be written", async () => {
    local.set("examBuilder.doc", JSON.stringify(exam));
    failWrites = true;
    expect((await loadAutosave())?.meta.title).toBe("Contrôle");
    expect(local.has("examBuilder.doc")).toBe(true);
  });

  it("reads the file first, and saves to it (a failed save throws)", async () => {
    await saveAutosave(exam as never);
    local.set("examBuilder.doc", JSON.stringify({ ...exam, meta: { title: "old" } }));
    expect((await loadAutosave())?.meta.title).toBe("Contrôle");
    failWrites = true;
    await expect(saveAutosave(exam as never)).rejects.toThrow("disk full");
  });

  it("moves the library too", async () => {
    local.set("examBuilder.userAssets", JSON.stringify([{ id: "user-1" }]));
    expect(await loadUserAssets()).toEqual([{ id: "user-1" }]);
    expect(local.has("examBuilder.userAssets")).toBe(false);
    expect(await loadUserAssets()).toEqual([{ id: "user-1" }]);
  });
});

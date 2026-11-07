import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AR, FR } from "../../uiStrings";

const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;

describe("the interface strings of the Image Studio", () => {
  const dir = join(__dirname, "../../../_components/image-studio");
  const files = [...readdirSync(dir).map((f) => join(dir, f)), join(__dirname, "../../../_components/inspector/ContentEditors.tsx")];
  const used = new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(T_CALL)].map((m) => m[1])));
  // (the names of the shapes of frame are written as data, then translated)
  for (const k of ["Free", "Original", "Square"]) used.add(k);

  it("finds the strings of the Studio", () => {
    expect(used.has("Image Studio")).toBe(true);
    expect(used.has("Edit the image: draw on it, crop it")).toBe(true);
  });

  it("has a French text and an Arabic text for each", () => {
    expect([...used].filter((k) => !(k in FR))).toEqual([]);
    expect([...used].filter((k) => !(k in AR))).toEqual([]);
  });
});

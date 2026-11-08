import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { editRegions, fieldPatch, fieldValue } from "../editRegions";
import { textRect } from "../shapes";
import type { ExamMeta, ShapeBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const shape = (kind: string, extra: Partial<ShapeBlock> = {}) => ({ ...(createBlock("shape", "fr", "p", { shape: kind, width: 200, height: 100 }) as ShapeBlock), ...extra });

describe("typing the text of a shape on the page", () => {
  it("types in the shape's room for text, a click anywhere on it", () => {
    const b = shape("rect", { text: "Bonjour" });
    const [r] = editRegions(b, 1, fr, "exam");
    const room = textRect(b, b.layout.width, b.layout.height);
    expect(r).toMatchObject({ field: { kind: "text" }, x: room.x, y: room.y, width: room.w, height: room.h, multiline: true });
    expect(r.hit).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(fieldValue(b, r.field)).toBe("Bonjour");
    expect(fieldPatch(b, r.field, "Salut\nà tous")).toEqual({ text: "Salut\nà tous" });
  });

  it("has nothing to type in a line or a picture", () => {
    expect(editRegions(shape("line"), 1, fr, "exam")).toEqual([]);
    expect(editRegions(shape("rect", { src: "data:," }), 1, fr, "exam")).toEqual([]);
  });
});

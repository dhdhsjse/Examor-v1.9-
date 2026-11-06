import { describe, expect, it } from "vitest";
import { AR, FR } from "../uiStrings";
import { BORDER_GROUPS, BORDER_STYLES, DEFAULT_BORDER, borderPaths, borderReach } from "../pageBorder";

const A4 = { w: 794, h: 1123 };

describe("page borders", () => {
  it("draws every design, with finite numbers only", () => {
    for (const style of BORDER_STYLES) {
      for (const width of [1, 2.5, 6]) {
        const paths = borderPaths({ ...DEFAULT_BORDER, style, width }, A4.w, A4.h);
        expect(paths.length, style).toBeGreaterThan(0);
        for (const p of paths) {
          expect(p.d.length, style).toBeGreaterThan(10);
          expect(p.d, `${style} ${width}`).not.toMatch(/NaN|Infinity|undefined/);
          expect(p.w).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps every stroke inside the page (a shadow may go a little past its line)", () => {
    for (const style of BORDER_STYLES) {
      const paths = borderPaths({ ...DEFAULT_BORDER, style, inset: 24 }, A4.w, A4.h);
      const numbers = paths.flatMap((p) => [...p.d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0])));
      // (arcs carry radii and flags, so only the coordinates of the straight commands are looked at: nothing is far outside the page)
      expect(Math.max(...numbers), style).toBeLessThan(A4.h + 100);
    }
  });

  it("is the same for the same page, and follows the page size", () => {
    const b = { ...DEFAULT_BORDER, style: "islamic" };
    expect(borderPaths(b, A4.w, A4.h)).toEqual(borderPaths(b, A4.w, A4.h));
    expect(borderPaths(b, 1123, 794)).not.toEqual(borderPaths(b, A4.w, A4.h));
  });

  it("draws nothing for an unknown design or a page too small for it", () => {
    expect(borderPaths({ ...DEFAULT_BORDER, style: "nope" }, A4.w, A4.h)).toEqual([]);
    expect(borderPaths({ ...DEFAULT_BORDER, style: "single", inset: 60 }, 100, 100)).toEqual([]);
  });

  it("says how far in a border reaches, so a header and a footer can stay inside it", () => {
    expect(borderReach(undefined)).toBe(0);
    expect(borderReach({ ...DEFAULT_BORDER, style: "nope" })).toBe(0);
    for (const style of BORDER_STYLES) {
      const near = borderReach({ ...DEFAULT_BORDER, style, inset: 10 });
      expect(near, style).toBeGreaterThan(10);
      expect(borderReach({ ...DEFAULT_BORDER, style, inset: 30 }), style).toBeGreaterThan(near);
      expect(borderReach({ ...DEFAULT_BORDER, style, width: 6 }), style).toBeGreaterThan(borderReach({ ...DEFAULT_BORDER, style, width: 1 }));
    }
    expect(borderReach({ ...DEFAULT_BORDER, style: "islamic" })).toBeGreaterThan(borderReach({ ...DEFAULT_BORDER, style: "single" }));
  });

  it("lists each design once, in a family", () => {
    const listed = BORDER_GROUPS.flatMap((g) => g.styles.map((s) => s.id));
    expect([...listed].sort()).toEqual([...BORDER_STYLES].sort());
  });

  it("has a French and an Arabic text for the names", () => {
    const names = ["Page borders", "Distance from the edge", ...BORDER_GROUPS.flatMap((g) => [g.name, ...g.styles.map((s) => s.name)])];
    expect(names.filter((n) => !FR[n])).toEqual([]);
    expect(names.filter((n) => !AR[n])).toEqual([]);
  });
});

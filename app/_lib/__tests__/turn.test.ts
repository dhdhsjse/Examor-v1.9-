import { describe, expect, it } from "vitest";
import { cornerForCentre, keepTurnedInside, normalTurn, turnAboutCentre, turnedBounds, turnedCentre } from "../turn";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("a turned text box", () => {
  it("keeps angles between -180 and 180", () => {
    expect(normalTurn(undefined)).toBe(0);
    expect(normalTurn(270)).toBe(-90);
    expect(normalTurn(-270)).toBe(90);
    expect(normalTurn(360)).toBe(0);
    expect(normalTurn(180)).toBe(180);
    expect(normalTurn(45.123)).toBe(45.12);
  });

  it("turns about its corner, so 90° puts the box under and left of it", () => {
    const [cx, cy] = turnedCentre(100, 100, 200, 50, 90);
    close(cx, 75);
    close(cy, 200);
    const b = turnedBounds(100, 100, 200, 50, 90);
    close(b.left, 50);
    close(b.right, 100);
    close(b.top, 100);
    close(b.bottom, 300);
  });

  it("finds the corner back from the middle", () => {
    for (const rot of [0, 45, 90, -90, 135, -30]) {
      const [cx, cy] = turnedCentre(120, 80, 200, 60, rot);
      const [x, y] = cornerForCentre(cx, cy, 200, 60, rot);
      close(x, 120);
      close(y, 80);
    }
  });

  it("turns about the middle: the middle does not move", () => {
    const before = { x: 100, y: 100 };
    const next = turnAboutCentre(before, 200, 50, 90);
    expect(next.rotation).toBe(90);
    const [cx, cy] = turnedCentre(next.x, next.y, 200, 50, 90);
    expect(cx).toBeCloseTo(200, 1);
    expect(cy).toBeCloseTo(125, 1);
    expect(turnAboutCentre({ ...next }, 200, 50, 0).rotation).toBeUndefined();
  });

  it("keeps a turned box inside the page", () => {
    // 90°: the box hangs to the left of its corner, so a corner at the left edge pushes it out
    const p = keepTurnedInside(10, 10, 200, 50, 90, 794, 1123);
    const b = turnedBounds(p.x, p.y, 200, 50, 90);
    expect(b.left).toBeGreaterThanOrEqual(-1e-6);
    expect(b.top).toBeGreaterThanOrEqual(-1e-6);
    const q = keepTurnedInside(780, 1110, 200, 50, 45, 794, 1123);
    const c = turnedBounds(q.x, q.y, 200, 50, 45);
    expect(c.right).toBeLessThanOrEqual(794 + 1e-6);
    expect(c.bottom).toBeLessThanOrEqual(1123 + 1e-6);
    // already inside: not moved
    expect(keepTurnedInside(300, 300, 100, 40, 30, 794, 1123)).toEqual({ x: 300, y: 300 });
  });
});

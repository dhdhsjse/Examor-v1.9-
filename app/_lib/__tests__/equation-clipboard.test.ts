import { describe, expect, it } from "vitest";
import { mathTabs } from "../keyboard/mathLayout";
import { physicsTabs } from "../keyboard/physicsLayout";
import {
  MAX_RECENT,
  withPinned,
  withRecentCleared,
  withRecorded,
  withRemoved,
  withUnpinned,
  worthKeeping,
  type ClipboardState,
} from "../keyboard/equationClipboard";

const empty: ClipboardState = { pinned: [], recent: [] };
const quad = "x=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}";
const lim = "\\lim_{x\\to+\\infty}f(x)=0";

describe("equation clipboard", () => {
  it("keeps finished equations, not short ones or ones with a box left to fill", () => {
    expect(worthKeeping(quad)).toBe(true);
    expect(worthKeeping("x^2")).toBe(false);
    expect(worthKeeping("  ")).toBe(false);
    expect(worthKeeping("\\frac{\\placeholder{}}{2}+\\sqrt{3}")).toBe(false);
  });

  it("puts the newest first and never twice", () => {
    let s = withRecorded(empty, quad);
    s = withRecorded(s, lim);
    expect(s.recent).toEqual([lim, quad]);
    s = withRecorded(s, quad);
    expect(s.recent).toEqual([quad, lim]);
  });

  it("a field finished again replaces its older draft instead of adding to it", () => {
    let s = withRecorded(withRecorded(empty, quad), "x=\\frac{1}{2}");
    s = withRecorded(s, lim);
    s = withRecorded(s, "x=\\frac{1}{2}+3", "x=\\frac{1}{2}");
    expect(s.recent).toEqual(["x=\\frac{1}{2}+3", lim, quad]);
  });

  it("forgets the oldest past the limit", () => {
    let s = empty;
    for (let i = 0; i < MAX_RECENT + 5; i++) s = withRecorded(s, `x_{${i}}+y_{${i}}=1`);
    expect(s.recent).toHaveLength(MAX_RECENT);
    expect(s.recent[0]).toBe(`x_{${MAX_RECENT + 4}}+y_{${MAX_RECENT + 4}}=1`);
  });

  it("a pinned equation leaves the recent list, stays when written again, and comes back to it when unpinned", () => {
    let s = withRecorded(withRecorded(empty, quad), lim);
    s = withPinned(s, quad);
    expect(s).toEqual({ pinned: [quad], recent: [lim] });
    expect(withRecorded(s, quad)).toBe(s);
    s = withUnpinned(s, quad);
    expect(s).toEqual({ pinned: [], recent: [quad, lim] });
  });

  it("clearing the recent ones keeps the pinned ones; remove takes one out of both", () => {
    const s = withPinned(withRecorded(withRecorded(empty, quad), lim), quad);
    expect(withRecentCleared(s)).toEqual({ pinned: [quad], recent: [] });
    expect(withRemoved(s, quad)).toEqual({ pinned: [], recent: [lim] });
  });
});

// The keyboard has building blocks; the only ready-made formulas are the physics laws, all in the Formulas tab, by field.
describe("keyboard keys are building blocks", () => {
  it.each([
    ["math", mathTabs],
    ["physics", physicsTabs],
  ] as const)("%s: no whole formula outside the Formulas tab", (_name, tabs) => {
    for (const tab of tabs) if (tab.id !== "formulas") for (const key of tab.buttons) expect(key.wide, `${tab.id}: ${key.title}`).toBeFalsy();
  });

  it("the physics formulas are in one tab, cut into the usual fields", () => {
    const formulas = physicsTabs.find((tab) => tab.id === "formulas");
    expect(formulas?.groups?.map((g) => g.id)).toEqual(["mechanics", "electricity", "waves", "nuclear", "chemistry"]);
    for (const g of formulas?.groups ?? []) expect(g.buttons.length, g.id).toBeGreaterThan(3);
    // The tab's keys are exactly those of its groups (what the tests of every key go through).
    expect(formulas?.buttons).toEqual(formulas?.groups?.flatMap((g) => g.buttons));
    expect(formulas?.buttons.every((key) => key.wide)).toBe(true);
  });
});

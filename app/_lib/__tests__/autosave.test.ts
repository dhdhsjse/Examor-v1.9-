import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaver } from "../autosave";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("the autosave queue", () => {
  it("writes one at a time, and only the latest change made meanwhile", async () => {
    const written: number[] = [];
    let release!: () => void;
    const write = vi.fn((v: number) => {
      written.push(v);
      return v === 1 ? new Promise<void>((r) => (release = r)) : Promise.resolve();
    });
    const saver = createSaver(write, () => {});
    saver.request(1);
    saver.request(2);
    saver.request(3);
    await flush();
    expect(written).toEqual([1]);
    release();
    await saver.idle();
    expect(written).toEqual([1, 3]);
  });

  it("says when a write worked or failed", async () => {
    const states: string[] = [];
    const saver = createSaver(
      (v: number) => (v === 2 ? Promise.reject(new Error("disk full")) : Promise.resolve()),
      (status, v) => states.push(`${status}:${v}`),
    );
    saver.request(1);
    await saver.idle();
    saver.request(2);
    await saver.idle();
    expect(states).toEqual(["saved:1", "error:2"]);
    saver.stop();
  });

  describe("after a failed write", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("tries again later until it works", async () => {
      let full = true;
      const states: string[] = [];
      const saver = createSaver<number>(() => (full ? Promise.reject(new Error("disk full")) : Promise.resolve()), (s, v) => states.push(`${s}:${v}`), 1000);
      saver.request(7);
      await saver.idle();
      expect(states).toEqual(["error:7"]);
      full = false;
      await vi.advanceTimersByTimeAsync(1000);
      await saver.idle();
      expect(states).toEqual(["error:7", "saved:7"]);
      saver.stop();
    });

    it("writes a newer change instead of trying the old one again", async () => {
      const written: number[] = [];
      const saver = createSaver(
        (v: number) => {
          written.push(v);
          return v === 1 ? Promise.reject(new Error("x")) : Promise.resolve();
        },
        () => {},
        1000,
      );
      saver.request(1);
      await saver.idle();
      saver.request(2);
      await saver.idle();
      await vi.advanceTimersByTimeAsync(5000);
      expect(written).toEqual([1, 2]);
      saver.stop();
    });
  });
});

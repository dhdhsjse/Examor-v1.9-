// Writing the exam being worked on, one write at a time: a change while a write runs is written right after it (only the latest one);
// a write that fails is tried again a little later, until one works (or a newer change is written).

export type SaveStatus = "saved" | "saving" | "error";

export interface Saver<T> {
  /** Write this one (after the write running now, if any). */
  request: (value: T) => void;
  /** Resolves once everything asked for is written, or failed. */
  idle: () => Promise<void>;
  stop: () => void;
}

export function createSaver<T>(write: (value: T) => Promise<void>, onState: (status: SaveStatus, value: T) => void, retryMs = 10_000): Saver<T> {
  let next: { value: T } | null = null;
  let running: Promise<void> | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const run = async () => {
    while (next && !stopped) {
      const { value } = next;
      next = null;
      try {
        await write(value);
        onState("saved", value);
      } catch {
        onState("error", value);
        // (again later, unless something newer is written first)
        clearTimeout(retry);
        retry = setTimeout(() => !next && !stopped && request(value), retryMs);
      }
    }
    running = null;
  };

  const request = (value: T) => {
    if (stopped) return;
    clearTimeout(retry);
    next = { value };
    running ??= run();
  };

  return {
    request,
    idle: async () => {
      while (running) await running;
    },
    stop: () => {
      stopped = true;
      clearTimeout(retry);
    },
  };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT_SCRIPT, THEME_KEY } from "../themeBoot";
import { loadThemeMode, resolveTheme } from "../theme";

const store = (value: string | null) => vi.stubGlobal("localStorage", { getItem: () => value, setItem: () => {} });
const system = (dark: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: dark, addEventListener: () => {}, removeEventListener: () => {} }));

describe("the look of the app", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the saved mode, and the system's when nothing (or nonsense) is saved", () => {
    store("dark");
    expect(loadThemeMode()).toBe("dark");
    store("light");
    expect(loadThemeMode()).toBe("light");
    store(null);
    expect(loadThemeMode()).toBe("system");
    store("purple");
    expect(loadThemeMode()).toBe("system");
  });

  it("does not break without storage (a private window)", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(loadThemeMode()).toBe("system");
  });

  it("follows the system only in system mode", () => {
    system(true);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    system(false);
    expect(resolveTheme("system")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("has a boot script that reads the same key", () => {
    expect(THEME_BOOT_SCRIPT).toContain(THEME_KEY);
    expect(() => new Function(THEME_BOOT_SCRIPT)).not.toThrow();
  });
});

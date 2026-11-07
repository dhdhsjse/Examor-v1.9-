import { describe, expect, it } from "vitest";
import { translate } from "../uiLang";

const RLM = "‏";

describe("the Arabic interface reads right-to-left inside the left-to-right layout", () => {
  it("puts a right-to-left mark in front of an Arabic text that starts with a Latin word", () => {
    expect(translate("ar", "pH and pKa")).toBe(`${RLM}pH و pKa`);
    expect(translate("ar", "Del — delete · Ctrl+D — duplicate").startsWith(RLM)).toBe(true);
  });

  it("also when the Latin word comes from a placeholder", () => {
    const s = translate("ar", "{element} has {used} bonds (usual: {allowed}).", { element: "C", used: 5, allowed: 4 });
    expect(s).toBe(`${RLM}C له 5 روابط (المعتاد: 4).`);
  });

  it("leaves Arabic-first texts, texts without Arabic, and the other languages as they are", () => {
    expect(translate("ar", "Export PDF")).toBe("تصدير PDF");
    expect(translate("ar", "{n} atoms", { n: 12 })).toBe("12 ذرة");
    expect(translate("ar", "y =")).toBe("y =");
    expect(translate("fr", "pH and pKa").includes(RLM)).toBe(false);
    expect(translate("en", "pH and pKa")).toBe("pH and pKa");
  });
});

describe("words that mean two things have a key each", () => {
  it("Bold is the text style; a bold bond and a right-angled triangle have their own words", () => {
    expect(translate("ar", "Bold")).toBe("غامق");
    expect(translate("fr", "Bold")).toBe("Gras");
    expect(translate("fr", "Bold bond")).toBe("Épaisse");
    expect(translate("ar", "Right")).toBe("يمين");
    expect(translate("ar", "Right-angled")).toBe("قائم الزاوية");
    expect(translate("fr", "Right-angled")).toBe("Rectangle");
  });
});

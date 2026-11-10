import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_ASSETS, PACK_ASSETS, matchesFilter, type LibraryFilter } from "../library";
import { PACK_CATEGORIES, PACK_ITEMS } from "../libraryPack";
import { foldText, matchesQuery, searchTerms } from "../searchText";

const PUBLIC = join(__dirname, "../../../public/library");
const read = (file: string) => readFileSync(join(PUBLIC, file), "utf8");

describe("the picture pack", () => {
  it("has unique ids, known categories and subcategories, and a name in each language", () => {
    expect(new Set(PACK_ITEMS.map((p) => p.id)).size).toBe(PACK_ITEMS.length);
    for (const p of PACK_ITEMS) {
      const category = PACK_CATEGORIES.find((c) => c.id === p.category);
      expect(category, p.id).toBeDefined();
      if (category?.subcategories) expect(category.subcategories.map((s) => s.id), p.id).toContain(p.subcategory);
      else expect(p.subcategory, p.id).toBeUndefined();
      for (const lang of ["en", "fr", "ar"] as const) expect(p.names[lang].trim(), `${p.id} ${lang}`).not.toBe("");
    }
  });

  it("fills every category and subcategory", () => {
    for (const c of PACK_CATEGORIES) {
      expect(PACK_ITEMS.some((p) => p.category === c.id), c.id).toBe(true);
      for (const s of c.subcategories ?? []) expect(PACK_ITEMS.some((p) => p.category === c.id && p.subcategory === s.id), `${c.id}/${s.id}`).toBe(true);
    }
  });

  it("has a print-friendly svg file for every item", () => {
    for (const p of PACK_ITEMS) {
      expect(existsSync(join(PUBLIC, p.file)), p.file).toBe(true);
      const svg = read(p.file);
      expect(svg.startsWith("<svg "), p.file).toBe(true);
      // a size (the size on the page), and nothing a print or a black-and-white export would lose
      expect(svg, p.file).toMatch(/ width="\d+" height="\d+"/);
      expect(svg, p.file).not.toMatch(/Gradient|<filter|<image|opacity|href=|url\(/);
      // colours as #hex (named colours would stay in colour in a black-and-white export)
      const colours = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
      for (const c of colours) expect(c, p.file).toMatch(/^(#[0-9a-f]{3}|#[0-9a-f]{6}|none)$/);
    }
  });

  it("is in the library, as pictures for every subject", () => {
    expect(PACK_ASSETS).toHaveLength(PACK_ITEMS.length);
    const ids = new Set(BUILTIN_ASSETS.map((a) => a.id));
    expect(ids.size).toBe(BUILTIN_ASSETS.length);
    for (const a of PACK_ASSETS) expect(ids.has(a.id)).toBe(true);
    const physics: LibraryFilter = { query: "", cycle: "all", year: "all", subject: "Physics", kind: "picture" };
    expect(PACK_ASSETS.every((a) => matchesFilter(a, physics))).toBe(true);
  });
});

describe("the library search", () => {
  const find = (query: string) => PACK_ASSETS.filter((a) => matchesQuery(a.terms!, query)).map((a) => a.id);

  it("folds case, French accents and Arabic marks and letter forms", () => {
    expect(foldText("Éléphant")).toBe("elephant");
    expect(foldText("Œil")).toBe("oeil");
    expect(foldText("تُفَّاحَة")).toBe("تفاحه");
    expect(foldText("أَرْنَب")).toBe("ارنب");
    expect(foldText("إجاصة")).toBe("اجاصه");
    expect(foldText("آلة")).toBe("اله");
    expect(foldText("مستشفى")).toBe("مستشفي");
    expect(foldText("ســـلام")).toBe("سلام");
    expect(foldText("٣ — ثلاثة")).toBe("3 ثلاثه");
  });

  it("finds a picture by any of its names, in any language", () => {
    for (const q of ["apple", "Apples", "pomme", "POMMES", "تفاح", "تفّاحة", "التفاح", "تفاحه"]) expect(find(q), q).toContain("pack-fruits-apple");
    expect(find("elephant")).toContain("pack-animals-elephant");
    expect(find("éléphant")).toContain("pack-animals-elephant");
    expect(find("الفيل")).toContain("pack-animals-elephant");
    expect(find("ارنب")).toContain("pack-animals-rabbit");
    expect(find("أرنب")).toContain("pack-animals-rabbit");
    expect(find("اجاص")).toContain("pack-fruits-pear");
  });

  it("finds a whole category by its name, and numbers by their words and digits", () => {
    const fruits = PACK_ITEMS.filter((p) => p.category === "fruits").length;
    expect(find("فواكه")).toHaveLength(fruits);
    expect(find("fruits")).toEqual(expect.arrayContaining(PACK_ASSETS.filter((a) => a.pack?.category === "fruits").map((a) => a.id)));
    for (const q of ["three", "trois", "ثلاثة", "ثلاث", "٣", "3"]) expect(find(q), q).toEqual(expect.arrayContaining(["pack-numbers-3", "pack-numbers-eastern-3"]));
    expect(find("?")).toContain("pack-symbols-question");
    expect(find("؟")).toContain("pack-symbols-question");
  });

  it("needs every word of the query, and finds nothing for punctuation alone", () => {
    expect(find("sea turtle")).toEqual(["pack-animals-turtle"]);
    expect(find("…")).toEqual([]);
    expect(matchesQuery(searchTerms(["Right triangle"]), "tri")).toBe(true);
  });
});

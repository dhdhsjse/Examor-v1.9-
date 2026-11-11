import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGURES, figureDef, renderFigure } from "../figures";
import { titrationPH } from "../figures/physics/chemistry";
import { PHYSICS_FIGURES } from "../figures/physics";
import { shells } from "../figures/physics/matter";
import { SCIENCE_FIGURES } from "../figures/sciences";
import { aminoAcid, codonsOf, toRNA } from "../figures/sciences/genetic";
import { mutate } from "../figures/sciences/mutations";
import { BUILTIN_ASSETS, PACK_ASSETS, matchesFilter, type LibraryFilter } from "../library";
import { PACK_CATEGORIES, PACK_ITEMS } from "../libraryPack";
import { foldText, matchesQuery, searchTerms } from "../searchText";
import { AR, FR } from "../uiStrings";

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

  it("has a print-friendly svg file for every item (or a figure drawn from settings)", () => {
    for (const p of PACK_ITEMS) {
      expect(Boolean(p.file) !== Boolean(p.figure), `${p.id}: a file or a figure`).toBe(true);
      if (!p.file) continue;
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

  it("is in the library: pictures for every subject, a subject's category as diagrams of that subject", () => {
    expect(PACK_ASSETS).toHaveLength(PACK_ITEMS.length);
    const ids = new Set(BUILTIN_ASSETS.map((a) => a.id));
    expect(ids.size).toBe(BUILTIN_ASSETS.length);
    for (const a of PACK_ASSETS) expect(ids.has(a.id)).toBe(true);
    const subjectCategories = new Set(PACK_CATEGORIES.filter((c) => c.subject).map((c) => c.id));
    const pictures = PACK_ASSETS.filter((a) => !subjectCategories.has(a.pack!.category));
    const physics: LibraryFilter = { query: "", cycle: "all", year: "all", subject: "Physics", kind: "picture" };
    expect(pictures.every((a) => matchesFilter(a, physics))).toBe(true);
    const sciences = PACK_ASSETS.filter((a) => a.pack!.category === "sciences");
    const sciencesShelf: LibraryFilter = { query: "", cycle: "lycee", year: "all", subject: "Sciences", kind: "diagram" };
    expect(sciences.length).toBeGreaterThan(0);
    expect(sciences.every((a) => matchesFilter(a, sciencesShelf))).toBe(true);
    expect(sciences.some((a) => matchesFilter(a, physics) || matchesFilter(a, { ...sciencesShelf, subject: "Math" }))).toBe(false);
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

describe("the Sciences pack", () => {
  const items = PACK_ITEMS.filter((p) => p.category === "sciences");
  const sciences = PACK_CATEGORIES.find((c) => c.id === "sciences")!;
  const find = (query: string) => PACK_ASSETS.filter((a) => matchesQuery(a.terms!, query)).map((a) => a.id);

  it("covers every topic with drawings and editable figures", () => {
    expect(sciences.subcategories!.map((s) => s.id)).toEqual(["matter", "growth", "cell", "nervous", "mutations", "synthesis", "structure", "enzymes", "immunity", "photosynthesis", "respiration"]);
    for (const s of sciences.subcategories!) expect(items.filter((p) => p.subcategory === s.id).length, s.id).toBeGreaterThanOrEqual(4);
    expect(items.some((p) => p.file)).toBe(true);
    expect(items.some((p) => p.figure)).toBe(true);
  });

  it("has static drawings without words, so they serve exams in any language", () => {
    for (const p of items.filter((i) => i.file)) {
      const words = [...read(p.file!).matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
      for (const w of words) expect(w, p.file).not.toMatch(/[؀-ۿ]|\b(the|le|la|les|de|of)\b/i);
    }
  });

  it("refers to figures that exist, are registered and draw in French and Arabic", () => {
    for (const p of items.filter((i) => i.figure)) {
      expect(figureDef(p.figure!.id), p.id).toBeDefined();
      for (const lang of ["fr", "ar"] as const) {
        const svg = renderFigure(p.figure!.id, p.figure!.params, lang)!.svg;
        expect(svg, `${p.id} ${lang}`).toMatch(/^<svg [^>]* width="\d+" height="\d+"/);
        expect(svg, `${p.id} ${lang}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
    for (const f of SCIENCE_FIGURES) expect(FIGURES).toContain(f);
  });

  it("draws every figure with every choice of every setting", () => {
    for (const f of SCIENCE_FIGURES) {
      for (const param of f.params) {
        const values = param.kind === "select" ? param.options.map((o) => o.value) : param.kind === "bool" ? [true, false] : param.kind === "number" ? [param.min, param.max] : param.kind === "text" ? ["", "x"] : [];
        for (const v of values)
          for (const lang of ["fr", "ar"] as const) {
            const svg = renderFigure(f.id, { [param.key]: v }, lang)!.svg;
            expect(svg, `${f.id} ${param.key}=${v} ${lang}`).not.toMatch(/NaN|undefined|Infinity/);
          }
      }
    }
  });

  it("has the words of its figures and their settings in French and Arabic", () => {
    const symbols = /^[\dA-Z₂ +.,()=<>]*$|^pH$|^O₂$/;
    for (const f of SCIENCE_FIGURES) {
      const keys = [f.name, f.hint, ...f.params.flatMap((p) => [p.label, ...(p.kind === "select" ? p.options.map((o) => o.label) : [])])].filter((k): k is string => !!k && !symbols.test(k));
      for (const k of keys) {
        expect(FR[k], `FR: ${k}`).toBeTruthy();
        expect(AR[k], `AR: ${k}`).toBeTruthy();
      }
    }
  });

  it("writes the names, numbers or the teacher's own names on a labeled diagram", () => {
    expect(renderFigure("sci-neuron", { labels: "names" }, "fr")!.svg).toContain("Axone");
    expect(renderFigure("sci-neuron", { labels: "names" }, "ar")!.svg).toContain("محور أسطواني");
    const numbered = renderFigure("sci-neuron", { labels: "numbers" }, "fr")!.svg;
    expect(numbered).not.toContain("Axone");
    expect(numbered).toContain(">1<");
    const own = renderFigure("sci-chromosome", { labels: "names", own: "un, deux" }, "fr")!.svg;
    expect(own).toContain(">un<");
    expect(own).toContain(">deux<");
    expect(renderFigure("sci-neuron", { labels: "none" }, "fr")!.svg).not.toMatch(/<text/);
  });

  it("writes Arabic right to left, so Latin words stay in their place", () => {
    expect(renderFigure("sci-dna-curve", {}, "ar")!.svg).toMatch(/direction="rtl">كمية ADN/);
  });

  it("works out a gene mutation and its amino acids", () => {
    const dna = "TACAAACGT";
    expect(mutate(dna, "substitution", 5, "T")).toEqual({ seq: "TACATACGT", at: 4 });
    expect(mutate(dna, "substitution", 1, "T").seq).toBe("CACAAACGT"); // (the same base would be no mutation)
    expect(mutate(dna, "deletion", 4, "").seq).toBe("TACAACGT");
    expect(mutate(dna, "insertion", 4, "G").seq).toBe("TACGAAACGT");
    expect(toRNA(dna, true)).toBe("AUGUUUGCA");
    expect(toRNA("ATG", false)).toBe("AUG");
    expect(codonsOf(toRNA(dna, true)).map(aminoAcid)).toEqual(["Met", "Phe", "Ala"]);
    expect(aminoAcid("UAA")).toBe("Stop");
  });

  it("is found by its topics and names in the three languages", () => {
    for (const q of ["mitosis", "mitose", "الانقسام المتساوي"]) expect(find(q), q).toContain("pack-sci-growth-mitosis");
    for (const q of ["antibody", "anticorps", "جسم مضاد"]) expect(find(q), q).toContain("pack-sci-immunity-antibody");
    for (const q of ["photosynthese", "التركيب الضوئي"]) expect(find(q), q).toContain("pack-sci-photosynthesis-chloroplast");
    expect(find("krebs")).toEqual(expect.arrayContaining(["pack-sci-respiration-krebs", "pack-sci-respiration-stages"]));
    expect(find("svt")).toHaveLength(items.length);
  });
});

describe("the Physics pack", () => {
  const items = PACK_ITEMS.filter((p) => p.category === "physics");
  const physics = PACK_CATEGORIES.find((c) => c.id === "physics")!;
  const find = (query: string) => PACK_ASSETS.filter((a) => matchesQuery(a.terms!, query)).map((a) => a.id);
  // (option labels that are symbols or units, the same in every language)
  const symbols = /^([\dA-Z₂ +.,()=<>/−′·]*|pH|pKa|pKa 2|O₂|mA|Ω|σ|He|Na|Hg|α|β−|β\+|γ)$/;

  it("covers every topic of the curriculum with drawings and editable figures", () => {
    expect(physics.subject).toBe("Physics");
    expect(physics.subcategories!.map((s) => s.id)).toEqual(["measures", "matter", "motion", "work", "potential", "thermal", "conductivity", "circuits", "rcrl", "optics", "light", "nuclear", "mechanics", "equilibrium"]);
    for (const s of physics.subcategories!) expect(items.filter((p) => p.subcategory === s.id).length, s.id).toBeGreaterThanOrEqual(5);
    expect(items.some((p) => p.file)).toBe(true);
    expect(items.some((p) => p.figure)).toBe(true);
  });

  it("is in the Physics shelf only, as diagrams for the lycée", () => {
    const assets = PACK_ASSETS.filter((a) => a.pack!.category === "physics");
    const shelf: LibraryFilter = { query: "", cycle: "lycee", year: "all", subject: "Physics", kind: "diagram" };
    expect(assets.length).toBe(items.length);
    expect(assets.every((a) => matchesFilter(a, shelf))).toBe(true);
    expect(assets.some((a) => matchesFilter(a, { ...shelf, subject: "Sciences" }) || matchesFilter(a, { ...shelf, subject: "Math" }) || matchesFilter(a, { ...shelf, cycle: "college" }))).toBe(false);
  });

  it("has static drawings without words, so they serve exams in any language", () => {
    for (const p of items.filter((i) => i.file)) {
      const words = [...read(p.file!).matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
      for (const w of words) expect(w, p.file).not.toMatch(/[؀-ۿ]|\b(the|le|la|les|de|of)\b/i);
    }
  });

  it("refers to figures that exist, are registered and draw in French and Arabic", () => {
    for (const p of items.filter((i) => i.figure)) {
      const def = figureDef(p.figure!.id);
      expect(def, p.id).toBeDefined();
      // (an item only sets settings its figure has)
      const keys = new Set(["ink", "labels", "own", ...def!.params.map((q) => q.key)]);
      for (const k of Object.keys(p.figure!.params ?? {})) expect(keys.has(k), `${p.id}: ${k}`).toBe(true);
      for (const lang of ["fr", "ar"] as const) {
        const svg = renderFigure(p.figure!.id, p.figure!.params, lang)!.svg;
        expect(svg, `${p.id} ${lang}`).toMatch(/^<svg [^>]* width="\d+" height="\d+"/);
        expect(svg, `${p.id} ${lang}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
    for (const f of PHYSICS_FIGURES) {
      expect(FIGURES).toContain(f);
      expect(f.id.startsWith("pc-"), f.id).toBe(true);
    }
    expect(new Set(FIGURES.map((f) => f.id)).size).toBe(FIGURES.length);
  });

  it("draws every figure with every choice of every setting", () => {
    for (const f of PHYSICS_FIGURES) {
      for (const param of f.params) {
        const values = param.kind === "select" ? param.options.map((o) => o.value) : param.kind === "bool" ? [true, false] : param.kind === "number" ? [param.min, param.max] : param.kind === "text" ? ["", "x"] : [];
        for (const v of values)
          for (const lang of ["fr", "ar"] as const) {
            const svg = renderFigure(f.id, { [param.key]: v }, lang)!.svg;
            expect(svg, `${f.id} ${param.key}=${v} ${lang}`).not.toMatch(/NaN|undefined|Infinity/);
          }
      }
    }
  });

  it("has the words of its figures and their settings in French and Arabic", () => {
    for (const f of PHYSICS_FIGURES) {
      const keys = [f.name, f.hint, ...f.params.flatMap((p) => [p.label, ...(p.kind === "select" ? p.options.map((o) => o.label) : [])])].filter((k): k is string => !!k && !symbols.test(k));
      for (const k of keys) {
        expect(FR[k], `FR: ${k}`).toBeTruthy();
        expect(AR[k], `AR: ${k}`).toBeTruthy();
      }
    }
  });

  it("writes the names or the numbers on a labeled apparatus", () => {
    expect(renderFigure("pc-titration", { labels: "names" }, "fr")!.svg).toContain("Burette graduée");
    expect(renderFigure("pc-titration", { labels: "names" }, "ar")!.svg).toContain("سحاحة مدرجة");
    const numbered = renderFigure("pc-titration", { labels: "numbers" }, "fr")!.svg;
    expect(numbered).not.toContain("Burette graduée");
    expect(numbered).toContain(">1<");
    expect(renderFigure("pc-cell", { labels: "names", m1: "Ag", m2: "Cu" }, "fr")!.svg).toContain("Solution d'ions Ag⁺");
  });

  it("works out the physics it draws", () => {
    expect(shells(11)).toEqual([2, 8, 1]);
    expect(shells(18)).toEqual([2, 8, 8]);
    expect(shells(20)).toEqual([2, 8, 8, 2]);
    // a weak acid at half-equivalence: pH = pKa; a strong acid by a strong base: pH 7 at equivalence
    expect(titrationPH("weak-acid", 4.8, 10, 5)).toBeCloseTo(4.8, 1);
    expect(titrationPH("strong-acid", 0, 10, 10)).toBeCloseTo(7, 1);
    expect(titrationPH("strong-acid", 0, 10, 0)).toBeCloseTo(1, 1);
    expect(titrationPH("weak-base", 9.2, 10, 5)).toBeCloseTo(9.2, 1);
    // beyond the critical angle (41.8° from glass to air) there is no refracted ray, so no angle i2
    const i2 = '>i<tspan dy="4" font-size="9">2<';
    expect(renderFigure("pc-refraction", { n1: 1.5, n2: 1, i1: 30, angles: true }, "fr")!.svg).toContain(i2);
    expect(renderFigure("pc-refraction", { n1: 1.5, n2: 1, i1: 50, angles: true }, "fr")!.svg).not.toContain(i2);
  });

  it("is found by its topics and names in the three languages", () => {
    for (const q of ["series circuit", "circuit en série", "دارة على التوالي"]) expect(find(q), q).toContain("pack-pc-circuits-series");
    for (const q of ["half-life", "demi-vie", "عمر النصف"]) expect(find(q), q).toContain("pack-pc-nuclear-decay");
    for (const q of ["pendule", "النواس البسيط"]) expect(find(q), q).toContain("pack-pc-potential-pendulum");
    for (const q of ["court-circuit", "dosage", "lentille convergente", "spectre", "condensateur", "réfraction"]) expect(find(q).some((id) => id.startsWith("pack-pc-")), q).toBe(true);
    expect(find("physique")).toHaveLength(items.length);
  });
});

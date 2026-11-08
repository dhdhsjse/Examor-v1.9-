import { describe, expect, it } from "vitest";
import { blockHeights, createBlock } from "../blocks";
import { examVersion, mixChoices, mixQuestions, NO_VERSIONS, versionName } from "../examVersions";
import type { Block, ExamDoc, McqBlock } from "../types";

const page = { id: "p1" };
function exam(blocks: Block[]): ExamDoc {
  return { version: 1, meta: { title: "Contrôle", lang: "fr" }, pages: [page], blocks } as unknown as ExamDoc;
}
function q(id: string, y: number, preset: Record<string, unknown> = {}): Block {
  const b = createBlock("mcq", "fr", page.id, { text: id, options: ["a", "b", "c", "d"], correct: 0, points: 1, ...preset });
  return { ...b, id, layout: { ...b.layout, y } };
}
function at(id: string, type: Parameters<typeof createBlock>[0], y: number, preset: Record<string, unknown> = {}): Block {
  const b = createBlock(type, "fr", page.id, preset);
  return { ...b, id, layout: { ...b.layout, y } };
}

describe("the answers to choose from, mixed", () => {
  it("keeps the right answer right", () => {
    const b = mixChoices(q("q1", 0, { options: ["Paris", "Rome", "Oslo", "Lima"], correct: 2 }), "s") as McqBlock;
    expect(b.options.slice().sort()).toEqual(["Lima", "Oslo", "Paris", "Rome"]);
    expect(b.options[b.correct]).toBe("Oslo");
    expect(b.options).not.toEqual(["Paris", "Rome", "Oslo", "Lima"]);
  });

  it("keeps several right answers right", () => {
    const b = mixChoices(q("q1", 0, { options: ["a", "b", "c", "d"], multi: true, corrects: [1, 3] }), "s") as McqBlock;
    expect(b.corrects!.map((i) => b.options[i]).sort()).toEqual(["b", "d"]);
  });

  it("is the same every time for the same version", () => {
    const b = q("q1", 0);
    expect(mixChoices(b, "x")).toEqual(mixChoices(b, "x"));
  });
});

describe("the questions of an exercise, mixed", () => {
  const blocks = () => {
    const title = at("t1", "text", 40, { text: "Exercice 1" });
    const qs = ["q1", "q2", "q3", "q4"].map((id, i) => q(id, 100 + i * 200));
    const figure = at("img", "shape", 505, { shape: "rect", width: 50, height: 20 }); // beside q3 (y 500)
    const next = at("t2", "text", 950, { text: "Exercice 2" });
    return [title, ...qs, figure, next];
  };

  it("puts them in another order in the same room, with what lies beside them", () => {
    const doc = exam(blocks());
    const out = mixQuestions(doc, "version-1");
    const y = (d: ExamDoc, id: string) => d.blocks.find((b) => b.id === id)!.layout.y;
    const ids = ["q1", "q2", "q3", "q4"];
    expect(ids.map((id) => y(out, id))).not.toEqual(ids.map((id) => y(doc, id)));
    // the same places, taken by others
    expect(ids.map((id) => y(out, id)).sort((a, b) => a - b)[0]).toBe(100);
    const h = blockHeights(doc);
    const last = ids.reduce((m, id) => Math.max(m, y(out, id) + h.get(id)!), 0);
    expect(last).toBe(Math.max(...ids.map((id) => y(doc, id) + h.get(id)!)));
    // the figure moved as much as its question; the titles did not move
    expect(y(out, "img") - 505).toBe(y(out, "q3") - 500);
    expect(y(out, "t1")).toBe(40);
    expect(y(out, "t2")).toBe(950);
  });

  it("does not mix across a title", () => {
    const doc = exam([q("q1", 100), at("t", "text", 300, { text: "Exercice 2" }), q("q2", 400)]);
    expect(mixQuestions(doc, "version-1")).toBe(doc);
  });

  it("leaves questions side by side as they are", () => {
    const a = q("q1", 100, { width: 300 });
    const b = { ...q("q2", 100, { width: 300 }), layout: { ...q("q2", 100).layout, x: 400, width: 300 } } as Block;
    const doc = exam([a, b]);
    expect(mixQuestions(doc, "v")).toBe(doc);
  });
});

describe("a version of the exam", () => {
  it("A is the exam as it is, with its name on it", () => {
    const doc = exam([q("q1", 100), q("q2", 300)]);
    const a = examVersion(doc, 0, { ...NO_VERSIONS, count: 2 });
    expect(a.blocks.slice(0, 2)).toEqual(doc.blocks);
    const tag = a.blocks[2];
    expect(tag.type === "textbox" && tag.text).toBe("Sujet A");
  });

  it("B is mixed, the same way each time", () => {
    const doc = exam([q("q1", 100), q("q2", 300), q("q3", 500)]);
    const plan = { count: 2, questions: true, choices: true };
    const b1 = examVersion(doc, 1, plan);
    const b2 = examVersion(doc, 1, plan);
    const strip = (d: ExamDoc) => d.blocks.filter((b) => b.type !== "textbox");
    expect(strip(b1)).toEqual(strip(b2));
    expect(strip(b1)).not.toEqual(doc.blocks);
  });

  it("names the versions in the exam's language", () => {
    expect(versionName("ar", 1)).toBe("الموضوع ب");
    expect(versionName("fr", 3)).toBe("Sujet D");
  });
});

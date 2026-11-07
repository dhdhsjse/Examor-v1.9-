// The model answer of a question as text for the correction sheet ("1) b : Paris", "2) 1 : True ; 2 : False", "3) 3a) …"), and the words the
// sheet prints itself. Pure: the generator (generate.ts) puts each answer in a block of the sheet, with the marks beside it.
import { blankAnswers, partLabel } from "../blockLayout";
import { mcqAnswers } from "../blocks";
import { optionLabel, words } from "../i18n";
import { parseRich, serializeRich, type Run } from "../richText";
import { fixOrder } from "../shuffle";
import type { Lang, QuestionBlock } from "../types";

// What the sheet writes by itself, in the language of the exam
const PRINTED = {
  fr: { title: "Corrigé et barème", sep: " ; ", comma: ", " },
  ar: { title: "الإجابة النموذجية وسلم التنقيط", sep: " ؛ ", comma: "، " },
};

export const printedWords = (lang: Lang) => PRINTED[lang] ?? PRINTED.fr;

/** One block of answer on the sheet: its text (rich), what it earns, and the sub-question it answers (an open question with parts has one per part) */
export interface AnswerPart {
  text: string;
  points: number;
  part?: number;
}

const plain = (text: string): Run => ({ text, style: {} });
const bold = (text: string): Run => ({ text, style: { b: true } });
const runs = (s: string | undefined): Run[] => parseRich(s ?? "");

/** The runs of `items`, one after the other with `between` in between */
const joined = (items: Run[][], between: string): Run[] => items.flatMap((it, i) => (i ? [plain(between), ...it] : it));

/** The model answer of question number `n`, as one or more blocks of text */
export function answerParts(q: QuestionBlock, n: number, lang: Lang): AnswerPart[] {
  const w = printedWords(lang);
  const head = (label: string): Run[] => (label ? [bold(`${label} `)] : []);
  const number = lang === "ar" ? `${n}-` : `${n})`;
  const one = (body: Run[]): AnswerPart[] => [{ text: serializeRich([...head(number), ...body]), points: q.points }];

  switch (q.type) {
    case "mcq": {
      const picks = mcqAnswers(q).filter((i) => i >= 0 && i < (q.options ?? []).length);
      return one(joined(picks.map((i) => [plain(`${optionLabel(i, lang)} : `), ...runs(q.options[i])]), w.sep));
    }
    case "truefalse": {
      const say = words(lang);
      const rows = (q.statements ?? []).map((s, i): Run[] => [plain(`${i + 1} : ${s.answer ? say.true : say.false}`), ...(!s.answer && s.fix?.trim() ? [plain(" ("), ...runs(s.fix), plain(")")] : [])]);
      return one(joined(rows, w.sep));
    }
    case "blank": {
      const answers = blankAnswers(q.content ?? "");
      return one(joined(answers.map((a, i): Run[] => [plain(answers.length > 1 ? `${i + 1} : ${a}` : a)]), w.sep));
    }
    case "open": {
      const parts = q.parts ?? [];
      if (!parts.length) return one(runs(q.answer));
      const out: AnswerPart[] = [];
      // (an answer typed for the question itself, above its sub-questions: it earns nothing of its own)
      const own = !!(q.answer ?? "").trim();
      if (own) out.push({ text: serializeRich([...head(number), ...runs(q.answer)]), points: 0 });
      // (the first line of the question carries its number, as on the paper: "2) a) …", then "b) …")
      parts.forEach((p, i) => {
        const label = partLabel(q, n, i, lang);
        const lead = i === 0 && !own ? [number, label].filter(Boolean).join(" ") : label;
        out.push({ text: serializeRich([...head(lead), ...runs(p.answer)]), points: p.points, part: i });
      });
      return out;
    }
    case "match": {
      // the left items are numbered 1, 2, 3…; the right ones are printed mixed up and lettered a, b, c… (see layoutMatch)
      const order = fixOrder(q.order, (q.pairs ?? []).length);
      return one(joined((q.pairs ?? []).map((_, k): Run[] => [plain(`${k + 1} = ${String.fromCharCode(97 + order.indexOf(k))}`)]), w.sep));
    }
    case "order": {
      if (q.style === "sentence") return one(runs((q.items ?? []).join(" ")));
      return one(joined((q.items ?? []).map((item, i): Run[] => [plain(`${i + 1}. `), ...runs(item)]), w.sep));
    }
    case "classify": {
      // one line per category: its name, then its words
      const lines = (q.groups ?? []).map((g): Run[] => [bold(`${parseRich(g.name ?? "").map((r) => r.text).join("")} : `), ...joined((g.items ?? []).map(runs), w.comma)]);
      return one(joined(lines, "\n"));
    }
  }
}

import type { Library } from "@/app/_features/core/types";
import { createBlock } from "@/app/_lib/blocks";
import { words } from "@/app/_lib/i18n";
import type { McqBlock } from "@/app/_lib/types";

// The four default options of a new QCM, in the exam's language.
const defaultOptions = (lang: "fr" | "ar") => (createBlock("mcq", lang, "") as McqBlock).options;

export const qcmLibrary: Library = {
  id: "lib.qcm",
  templates: [
    {
      id: "lib.qcm.four",
      label: (t) => t("Multiple choice — 4 options"),
      description: (t) => t("Four options, the first one correct."),
      recommended: true,
      item: () => ({ type: "mcq" }),
    },
    {
      id: "lib.qcm.three",
      label: (t) => t("Multiple choice — 3 options"),
      description: (t) => t("Three options, the first one correct."),
      item: (ctx) => ({ type: "mcq", preset: { options: defaultOptions(ctx.doc.meta.lang).slice(0, 3) } }),
    },
    {
      id: "lib.qcm.true-false",
      label: (t) => t("True or false"),
      description: (t) => t("Two answers, true or false."),
      item: (ctx) => {
        const w = words(ctx.doc.meta.lang);
        return { type: "mcq", preset: { options: [w.true, w.false] } };
      },
    },
  ],
};

import type { Group } from "@/app/_features/core/types";
import { toolQuestionBlank } from "@/app/_features/tools/tool-question-blank";
import { toolQuestionMcq } from "@/app/_features/tools/tool-question-mcq";
import { toolQuestionOpen } from "@/app/_features/tools/tool-question-open";
import { toolQuestionTrueFalse } from "@/app/_features/tools/tool-question-truefalse";

export const questionsGroup: Group = {
  id: "group.questions",
  order: 30,
  label: (t) => t("Questions"),
  className: "grid grid-cols-2 gap-2",
  features: [toolQuestionMcq, toolQuestionTrueFalse, toolQuestionBlank, toolQuestionOpen],
};

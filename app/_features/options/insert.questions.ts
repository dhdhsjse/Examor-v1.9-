import type { Option } from "@/app/_features/core/types";
import { toolQuestionBlank } from "@/app/_features/tools/tool-question-blank";
import { toolQuestionClassify } from "@/app/_features/tools/tool-question-classify";
import { toolQuestionMatch } from "@/app/_features/tools/tool-question-match";
import { toolQuestionMcq } from "@/app/_features/tools/tool-question-mcq";
import { toolQuestionOpen } from "@/app/_features/tools/tool-question-open";
import { toolQuestionOrder } from "@/app/_features/tools/tool-question-order";
import { toolQuestionTrueFalse } from "@/app/_features/tools/tool-question-truefalse";

export const insertQuestionsOption: Option = {
  id: "option.insert.questions",
  order: 10,
  label: (t) => t("Questions"),
  features: [toolQuestionMcq, toolQuestionTrueFalse, toolQuestionBlank, toolQuestionOpen, toolQuestionMatch, toolQuestionOrder, toolQuestionClassify],
};

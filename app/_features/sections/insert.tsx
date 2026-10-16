import { Type } from "lucide-react";
import type { Section } from "@/app/_features/core/types";
import { insertContentOption } from "@/app/_features/options/insert.content";
import { insertGraphsOption } from "@/app/_features/options/insert.graphs";
import { insertMediaOption } from "@/app/_features/options/insert.media";
import { insertQuestionsOption } from "@/app/_features/options/insert.questions";

export const insertSection: Section = {
  id: "section.insert",
  order: 20,
  label: (t) => t("Insert"),
  icon: <Type size={20} strokeWidth={1.7} />,
  options: [insertQuestionsOption, insertContentOption, insertGraphsOption, insertMediaOption],
};

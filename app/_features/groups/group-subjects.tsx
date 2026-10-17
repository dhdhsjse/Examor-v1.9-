import { ChevronDown } from "lucide-react";
import type { Group } from "@/app/_features/core/types";
import { subjectArabic } from "@/app/_features/actions/subject-arabic";
import { subjectFrench } from "@/app/_features/actions/subject-french";
import { subjectGeneral } from "@/app/_features/actions/subject-general";
import { subjectMath } from "@/app/_features/actions/subject-math";
import { subjectPhysics } from "@/app/_features/actions/subject-physics";
import { subjectSciences } from "@/app/_features/actions/subject-sciences";

// "Subject: Math ▾". The subject is picked once per exam; it decides which tools the toolbox shows.
export const subjectsGroup: Group = {
  id: "group.subjects",
  order: 30,
  menu: true,
  className: "shrink-0",
  header: (ctx) => (
    <span className="flex items-center gap-1">
      <span className="font-normal text-muted">{ctx.t("Subject:")}</span>
      {ctx.t(ctx.shell.subject)}
      <ChevronDown size={14} strokeWidth={2} className="text-muted" aria-hidden />
    </span>
  ),
  features: [subjectGeneral, subjectMath, subjectPhysics, subjectSciences, subjectArabic, subjectFrench],
};

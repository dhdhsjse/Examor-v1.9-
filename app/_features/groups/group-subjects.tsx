import type { Group } from "@/app/_features/core/types";
import { subjectArabic } from "@/app/_features/toggles/subject-arabic";
import { subjectFrench } from "@/app/_features/toggles/subject-french";
import { subjectGeneral } from "@/app/_features/toggles/subject-general";
import { subjectMath } from "@/app/_features/toggles/subject-math";
import { subjectPhysics } from "@/app/_features/toggles/subject-physics";
import { subjectSciences } from "@/app/_features/toggles/subject-sciences";

export const subjectsGroup: Group = {
  id: "group.subjects",
  order: 30,
  className: "flex items-center gap-0.5 rounded-md bg-subtle p-0.5 ring-1 ring-line",
  features: [subjectGeneral, subjectMath, subjectPhysics, subjectSciences, subjectArabic, subjectFrench],
};

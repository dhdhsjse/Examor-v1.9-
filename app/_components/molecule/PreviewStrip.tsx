"use client";

import { useMemo } from "react";
import { useT } from "@/app/_lib/uiLang";
import type { MoleculeBlockData } from "@/app/_molecule/model";
import { renderMolecule } from "@/app/_molecule/render";

// The two sheets this molecule gives: what the student gets and the answer key.
export default function PreviewStrip({ block, vertical }: { block: MoleculeBlockData; vertical?: boolean }) {
  const t = useT();
  const { student, answer } = useMemo(
    () => ({
      student: renderMolecule({ ...block, exerciseMode: "student" }).svg,
      answer: renderMolecule({ ...block, exerciseMode: "answer" }).svg,
    }),
    [block],
  );

  const card = (title: string, svg: string, id: string) => (
    <figure className="flex min-w-0 flex-1 flex-col gap-1" data-testid={id}>
      <figcaption className="text-[11px] font-semibold text-muted">{title}</figcaption>
      <div dir="ltr" className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-line bg-white [&>svg]:h-auto [&>svg]:max-h-24 [&>svg]:w-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );

  return (
    <div className={`flex gap-3 ${vertical ? "flex-col" : ""}`}>
      {card(t("Student version"), student, "preview-student")}
      {card(t("Answer key"), answer, "preview-answer")}
    </div>
  );
}

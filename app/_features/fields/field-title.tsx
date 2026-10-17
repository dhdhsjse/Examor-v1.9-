"use client";

import { useRef } from "react";
import type { Ctx, Feature } from "@/app/_features/core/types";

// The exam's name in the top bar: click it to rename. Enter keeps the new name, Escape puts the
// old one back, and an emptied name returns to what it was.
function TitleInput({ ctx }: { ctx: Ctx }) {
  const before = useRef(ctx.shell.title);
  const { t, shell } = ctx;
  return (
    <input
      value={shell.title}
      onFocus={(e) => (before.current = e.target.value)}
      onChange={(e) => shell.setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") shell.setTitle(before.current);
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
      onBlur={(e) => !e.target.value.trim() && shell.setTitle(before.current.trim() || t("Untitled exam"))}
      dir="auto"
      spellCheck={false}
      aria-label={t("Exam name")}
      title={t("Click to rename")}
      className="min-w-16 max-w-80 shrink truncate rounded-md px-1.5 py-1 text-[13px] font-medium text-ink ring-1 ring-transparent outline-none transition-colors [field-sizing:content] hover:bg-subtle hover:ring-line focus:bg-white focus:ring-indigo-300"
    />
  );
}

export const titleField: Feature = {
  id: "field.title",
  kind: "field",
  label: "Exam name",
  render: ({ ctx }) => <TitleInput ctx={ctx} />,
};

import { FileIcon } from "@/app/_components/icons";
import type { Group } from "@/app/_features/core/types";
import { fileHistoryAction } from "@/app/_features/actions/file-history";
import { fileNewAction } from "@/app/_features/actions/file-new";
import { fileOpenAction } from "@/app/_features/actions/file-open";
import { filePreviewAction } from "@/app/_features/actions/file-preview";
import { fileSaveAction } from "@/app/_features/actions/file-save";

export const fileGroup: Group = {
  id: "group.file",
  order: 10,
  menu: true,
  header: (ctx) => (
    <span className="flex items-center gap-1">
      <FileIcon /> {ctx.t("File")}
    </span>
  ),
  features: [fileNewAction, fileOpenAction, fileSaveAction, fileHistoryAction, filePreviewAction],
};

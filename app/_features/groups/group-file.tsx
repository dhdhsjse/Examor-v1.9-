import { FileIcon } from "@/app/_components/icons";
import type { Group } from "@/app/_features/core/types";
import { fileHistoryAction } from "@/app/_features/actions/file-history";
import { fileNewAction } from "@/app/_features/actions/file-new";
import { fileReconfigureAction } from "@/app/_features/actions/file-reconfigure";
import { fileOpenAction } from "@/app/_features/actions/file-open";
import { filePreviewAction } from "@/app/_features/actions/file-preview";
import { fileSaveAction } from "@/app/_features/actions/file-save";
import { langArAction } from "@/app/_features/actions/lang-ar";
import { langEnAction } from "@/app/_features/actions/lang-en";
import { langFrAction } from "@/app/_features/actions/lang-fr";

// The File menu. It also holds the app's own language, so the only language control in the
// editor itself is the exam language (Properties panel).
export const fileGroup: Group = {
  id: "group.file",
  order: 10,
  menu: true,
  className: "shrink-0",
  header: (ctx) => (
    <span className="flex items-center gap-1">
      <FileIcon /> {ctx.t("File")}
    </span>
  ),
  features: [
    fileNewAction,
    fileReconfigureAction,
    fileOpenAction,
    fileSaveAction,
    fileHistoryAction,
    filePreviewAction,
    langEnAction,
    langFrAction,
    langArAction,
  ],
};

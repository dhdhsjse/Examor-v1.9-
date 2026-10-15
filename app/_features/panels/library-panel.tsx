import LibraryPanel from "@/app/_components/library/LibraryPanel";
import type { Feature } from "@/app/_features/core/types";

// Built-in and user library (the Library tab). Dragging from here puts items on the page.
export const libraryPanel: Feature = {
  id: "panel.library",
  kind: "panel",
  label: "Library",
  render: ({ ctx }) => {
    const { shell } = ctx;
    return (
      <LibraryPanel
        key={`${shell.subject}-${shell.library.n}`}
        subject={shell.subject}
        initialKind={shell.library.kind}
        userAssets={shell.userAssets}
        onUse={(a) => shell.runTool({ kind: "asset", assetId: a.id })}
        onImport={() => shell.importImage(false)}
        onDeleteUserAsset={shell.deleteUserAsset}
      />
    );
  },
};

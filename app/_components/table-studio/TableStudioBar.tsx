"use client";

import { ImagePlus, Keyboard, Type } from "lucide-react";
import type { ComponentProps } from "react";
import { toggleStudioKeyboard, useKeyboardStore } from "@/app/_components/math-keyboard/keyboardStore";
import DrawTools from "@/app/_components/workspace/DrawTools";
import EraserTools from "@/app/_components/workspace/EraserTools";
import TableDrawBar, { tableBarButton, tableBarSep } from "@/app/_components/workspace/TableDrawBar";
import type { EraserTool } from "@/app/_lib/ink/useEraserTool";
import type { InkTools } from "@/app/_lib/ink/useInkTools";
import { useT } from "@/app/_lib/uiLang";
import type { TableTool } from "./TableDrawingLayer";

interface Props {
  /** The table tools of the bar (the pen, the line eraser, the bucket, Merge and Split), as on the page */
  table: Omit<ComponentProps<typeof TableDrawBar>, "studio" | "onClose" | "hasTable">;
  /** The Studio's own tool in hand */
  tool: TableTool;
  onTool: (tool: TableTool) => void;
  ink: InkTools;
  eraser: EraserTool;
  /** An image from the computer, put on the table */
  onImage: () => void;
}

// The floating bar of the Table Studio, at the bottom of the table: the bar of the tables of the page (TableDrawBar: Select, the pen that
// draws the lines of the table, the eraser of lines, the bucket, Merge and Split), then what is drawn over the table (the page's Draw
// tool with its brush, pencil and highlighter, Text box, Eraser, an image from the computer); after a line, the math keyboard.
export default function TableStudioBar({ table, tool, onTool, ink, eraser, onImage }: Props) {
  const t = useT();
  const { studio: keyboardOpen } = useKeyboardStore();
  const keyboardText = keyboardOpen ? t("Hide math keyboard") : t("Show math keyboard");
  const textbox = t("Text box: drag on the table to draw one, then type");
  const image = t("Image from this computer…");
  return (
    // (at the bottom: what the bar opens — the colors, Split — opens over it)
    <div data-side="above" className="group/table-dock pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <TableDrawBar
        {...table}
        hasTable
        studio={
          <>
            {/* (each pen with its eraser after it: the table's, then the drawing's) */}
            <DrawTools open={tool === "draw"} ink={ink} onOpen={() => onTool("draw")} onDark />
            <EraserTools open={tool === "eraser"} eraser={eraser} onOpen={() => onTool("eraser")} button={tableBarButton} />
            <button type="button" onClick={() => onTool(tool === "textbox" ? "select" : "textbox")} aria-pressed={tool === "textbox"} title={textbox} aria-label={textbox} data-testid="tool-textbox" className={tableBarButton(tool === "textbox")}>
              <Type aria-hidden />
            </button>
            <button type="button" onClick={onImage} title={image} aria-label={image} data-testid="tool-image" className={tableBarButton(false)}>
              <ImagePlus aria-hidden />
            </button>
            {tableBarSep}
            <button type="button" onClick={toggleStudioKeyboard} aria-pressed={keyboardOpen} title={keyboardText} aria-label={keyboardText} data-testid="keyboard-toggle" className={tableBarButton(keyboardOpen)}>
              <Keyboard aria-hidden />
            </button>
          </>
        }
      />
    </div>
  );
}

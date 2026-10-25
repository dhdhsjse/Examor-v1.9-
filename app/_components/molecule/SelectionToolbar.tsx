"use client";

import { useEffect, useState, type RefObject } from "react";
import { Eye, EyeOff, SquareDashed, Trash2, Type } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { isEmpty, type Selection } from "@/app/_molecule/edit/select";
import type { Visibility } from "@/app/_molecule/model";
import { ActionButton } from "./ui";

interface Props {
  container: RefObject<HTMLDivElement | null>; // the drawing area (it is `relative`)
  selection: Selection;
  version: string; // changes when the drawing moves or is redrawn
  onVisibility: (v: Visibility) => void;
  onLabel: () => void;
  onRemove: () => void;
}

interface Spot {
  x: number;
  y: number;
}

const ids = (s: Selection) => [...s.atoms.map((i) => `[data-atom-id="${i}"]`), ...s.bonds.map((i) => `[data-bond-id="${i}"]`), ...s.lonePairs.map((i) => `[data-lp-id="${i}"]`)];

// Appears next to what is selected: the three things a teacher does most (hide it, leave it blank, show it again),
// so that nothing has to be searched for in a side panel.
export default function SelectionToolbar({ container, selection, version, onVisibility, onLabel, onRemove }: Props) {
  const t = useT();
  const [spot, setSpot] = useState<Spot | null>(null);
  const empty = isEmpty(selection);
  const key = ids(selection).join(",");

  useEffect(() => {
    if (empty) return;
    // Measured after the drawing has been laid out; set from the frame callback, not from the effect body.
    const frame = requestAnimationFrame(() => {
      const box = container.current;
      if (!box) return;
      const parts = [...box.querySelectorAll(key.split(",").map((s) => `[data-testid="edit-canvas"] ${s}`).join(","))];
      if (!parts.length) return setSpot(null);
      const c = box.getBoundingClientRect();
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const p of parts) {
        const r = p.getBoundingClientRect();
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      const x = Math.min(Math.max((left + right) / 2 - c.left, 130), Math.max(130, c.width - 130));
      // under the whole drawing when there is room, so it never hides a neighbouring atom; else above the selection
      const drawing = box.querySelector('[data-testid="edit-canvas"] svg')?.getBoundingClientRect();
      const under = drawing ? drawing.bottom + 8 : bottom + 10;
      const room = c.bottom - under > 48;
      setSpot({ x, y: room ? under - c.top : Math.max(4, top - c.top - 46) });
    });
    return () => cancelAnimationFrame(frame);
  }, [container, empty, key, version]);

  if (empty || !spot) return null;
  const canLabel = selection.atoms.length > 0;
  const canRemove = selection.atoms.length > 0 || selection.bonds.length > 0;
  return (
    <div
      role="toolbar"
      aria-label={t("What to do with the selection")}
      data-testid="selection-toolbar"
      className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-lg"
      style={{ left: spot.x, top: spot.y }}
    >
      <ActionButton icon={<EyeOff size={14} />} label={t("Hide")} hint={t("Hide in the student version")} shortcut="H" onClick={() => onVisibility("hidden")} />
      <ActionButton icon={<SquareDashed size={14} />} label={t("Blank")} hint={t("Leave an empty box for the student to fill")} shortcut="B" onClick={() => onVisibility("blank")} disabled={selection.atoms.length + selection.bonds.length === 0} />
      <ActionButton icon={<Eye size={14} />} label={t("Show")} hint={t("Show it again")} shortcut="S" onClick={() => onVisibility("shown")} />
      {canLabel && <ActionButton icon={<Type size={14} />} label={t("Text")} hint={t("Write a text instead of the atom")} onClick={onLabel} iconOnly />}
      {canRemove && (
        <>
          <div className="mx-0.5 h-5 w-px bg-line" />
          <ActionButton icon={<Trash2 size={14} />} label={t("Remove")} hint={t("Remove from the molecule (both versions)")} shortcut="Del" onClick={onRemove} tone="danger" iconOnly />
        </>
      )}
    </div>
  );
}

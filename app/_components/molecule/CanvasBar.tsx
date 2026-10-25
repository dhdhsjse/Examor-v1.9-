"use client";

import { ListFilter, Redo2, Shapes, Undo2, ZoomIn, ZoomOut, CircleHelp } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { SHORTCUTS } from "@/app/_molecule/strings";
import { allBonds, allHydrogens, allLonePairs, bondsOfAtoms, emptySelection, hydrogensOfAtoms, isEmpty, lonePairsOfAtoms } from "@/app/_molecule/edit/select";
import type { MolGraph } from "@/app/_molecule/model";
import type { Selection } from "@/app/_molecule/edit/select";
import { ActionButton, Kbd, Menu, MenuItem } from "./ui";

interface Props {
  graph: MolGraph;
  selection: Selection;
  setSelection: (s: Selection) => void;
  editable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  onIsomers: () => void;
  isomersAvailable: boolean;
}

// Above the drawing: what to select, undo / redo, zoom, and the isomer gallery.
export default function CanvasBar({ graph, selection, setSelection, editable, canUndo, canRedo, onUndo, onRedo, zoom, setZoom, onIsomers, isomersAvailable }: Props) {
  const t = useT();
  const atoms = selection.atoms;
  return (
    <div className="flex items-center gap-1.5 border-b border-line bg-white px-3 py-2">
      <Menu
        trigger={(open, toggle) => (
          <ActionButton icon={<ListFilter size={14} />} label={t("Select")} hint={t("Select several things at once")} onClick={toggle} disabled={!editable} active={open} />
        )}
      >
        {(close) => (
          <>
            <MenuItem onClick={() => (setSelection(allHydrogens(graph)), close())}>{t("All hydrogens")}</MenuItem>
            <MenuItem onClick={() => (setSelection(allBonds(graph)), close())}>{t("All bonds")}</MenuItem>
            <MenuItem onClick={() => (setSelection(allLonePairs(graph)), close())}>{t("All lone pairs")}</MenuItem>
            <div className="my-1 h-px bg-line" />
            <MenuItem onClick={() => (setSelection(hydrogensOfAtoms(graph, atoms)), close())} disabled={!atoms.length}>
              {t("Hydrogens of the selected atoms")}
            </MenuItem>
            <MenuItem onClick={() => (setSelection(bondsOfAtoms(graph, atoms)), close())} disabled={!atoms.length}>
              {t("Bonds of the selected atoms")}
            </MenuItem>
            <MenuItem onClick={() => (setSelection(lonePairsOfAtoms(graph, atoms)), close())} disabled={!atoms.length}>
              {t("Lone pairs of the selected atoms")}
            </MenuItem>
            <div className="my-1 h-px bg-line" />
            <MenuItem onClick={() => (setSelection(emptySelection()), close())} disabled={isEmpty(selection)} hint="Esc">
              {t("Select none")}
            </MenuItem>
          </>
        )}
      </Menu>

      <div className="mx-1 h-5 w-px bg-line" />
      <ActionButton icon={<Undo2 size={15} />} label={t("Undo")} shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo} iconOnly />
      <ActionButton icon={<Redo2 size={15} />} label={t("Redo")} shortcut="Ctrl+Y" onClick={onRedo} disabled={!canRedo} iconOnly />

      <div className="ms-auto flex items-center gap-1.5">
        <ActionButton icon={<Shapes size={14} />} label={t("Isomers")} hint={t("Browse the isomers of this formula")} onClick={onIsomers} disabled={!isomersAvailable} />
        <div className="mx-1 h-5 w-px bg-line" />
        <ActionButton icon={<ZoomOut size={15} />} label={t("Zoom out")} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} iconOnly />
        <button onClick={() => setZoom(1)} title={t("Back to 100%")} className="w-12 rounded-md py-1 text-center text-xs text-muted hover:bg-subtle">
          {Math.round(zoom * 100)}%
        </button>
        <ActionButton icon={<ZoomIn size={15} />} label={t("Zoom in")} onClick={() => setZoom(Math.min(3, zoom + 0.25))} iconOnly />
        <Menu
          align="end"
          trigger={(open, toggle) => <ActionButton icon={<CircleHelp size={15} />} label={t("Keyboard shortcuts")} onClick={toggle} active={open} iconOnly />}
        >
          {() => (
            <div className="flex w-60 flex-col gap-1.5 p-2 text-xs text-ink">
              <p className="font-semibold">{t("Keyboard shortcuts")}</p>
              {SHORTCUTS.map(([k, what]) => (
                <p key={k} className="flex items-center justify-between gap-3">
                  <span>{t(what)}</span>
                  <Kbd>{k}</Kbd>
                </p>
              ))}
            </div>
          )}
        </Menu>
      </div>
    </div>
  );
}

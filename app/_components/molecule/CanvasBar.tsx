"use client";

import { CircleHelp, ListFilter, Minus, Plus } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { SHORTCUTS } from "@/app/_molecule/strings";
import { allBonds, allHydrogens, allLonePairs, bondsOfAtoms, emptySelection, hydrogensOfAtoms, isEmpty, lonePairsOfAtoms } from "@/app/_molecule/edit/select";
import type { MolGraph } from "@/app/_molecule/model";
import type { Selection } from "@/app/_molecule/edit/select";
import { ActionButton, Kbd, Menu, MenuItem, floatingBar } from "./ui";

interface Props {
  graph: MolGraph;
  selection: Selection;
  setSelection: (s: Selection) => void;
  editable: boolean;
  zoom: number;
  setZoom: (z: number) => void;
}

// Floating under the drawing, like the page's tool bar: what to select at once, the zoom, and the keyboard shortcuts.
export default function CanvasBar({ graph, selection, setSelection, editable, zoom, setZoom }: Props) {
  const t = useT();
  const atoms = selection.atoms;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
      <div className={`pointer-events-auto ${floatingBar}`} data-testid="canvas-bar">
        {editable && (
          <>
            <Menu
              up
              trigger={(open, toggle) => (
                <ActionButton icon={<ListFilter size={14} />} label={t("Select")} hint={t("Select several things at once")} onClick={toggle} active={open} testId="select-menu" />
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
            <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
          </>
        )}
        <ActionButton icon={<Minus size={15} />} label={t("Zoom out")} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} disabled={zoom <= 0.5} iconOnly />
        <button type="button" onClick={() => setZoom(1)} title={t("Back to 100%")} className="h-8 min-w-12 rounded-[5px] px-1.5 text-center text-xs font-medium text-ink tabular-nums transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent">
          {Math.round(zoom * 100)}%
        </button>
        <ActionButton icon={<Plus size={15} />} label={t("Zoom in")} onClick={() => setZoom(Math.min(3, zoom + 0.25))} disabled={zoom >= 3} iconOnly />
        {editable && (
          <>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
            <Menu
              up
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
          </>
        )}
      </div>
    </div>
  );
}


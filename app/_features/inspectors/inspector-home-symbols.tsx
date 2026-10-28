import { Omega } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import SymbolsInspector from "./home/SymbolsInspector";

// Home → Symbols: Greek letters, math, units, arrows, accents, Arabic… to put in the text being typed in.
export const inspectorHomeSymbols: Feature = {
  id: "inspector.home.symbols",
  kind: "panel",
  target: "inspector",
  followsSelection: true,
  order: 30,
  label: "Symbols",
  icon: <Omega size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <SymbolsInspector ctx={ctx} />,
};

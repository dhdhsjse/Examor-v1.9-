// A drawing as one of the school representations: the drawing is written as a molfile, read by the engine, given back what it
// has that the engine's graph does not (engineGraph.ts) and its masks (masking.ts), and drawn by the generator's renderers.
// Not React: the Studio calls it from a hook, the tests call it directly.
import type { ChemEngine } from "../../_molecule/engine/ChemEngine";
import { parseMolfile } from "../../_molecule/engine/molfile";
import { defaultRenderOptions, emptyEdits } from "../../_molecule/model";
import type { MolGraph, MoleculeBlockData, Representation } from "../../_molecule/model";
import { renderMolecule } from "../../_molecule/render";
import { NON_COVALENT_BONDS } from "./bondGeometry";
import { drawingOnEngine } from "./engineGraph";
import { moleculesOf } from "./formula";
import { engineEdits, maskedCount, type StudioView } from "./masking";
import { drawingToMolfile } from "./molfile";
import type { MoleculeGraph } from "./types";

/** Something the teacher should know about a representation that was made anyway (a small "!" over it). */
export type RepresentationNote = "unchecked" | "unmasked";

export type MadeRepresentation = { block: MoleculeBlockData; svg: string; notes: RepresentationNote[] };

/**
 * The drawing in the representation `rep`. The student's view is the engine's student version (the masks applied); the
 * teacher's is the answer key, with what the students would not see drawn faded. The block carries those edits, so putting it
 * on the page puts exactly what is shown.
 *
 * A sketch that the engine cannot make sense of (a carbon with five bonds…) is not refused: it is drawn as it is, with the note
 * "unchecked" (the engine would have added the hydrogens it lacks and laid it out, and does neither).
 */
export async function makeRepresentation(graph: MoleculeGraph, rep: Representation, view: StudioView, lang: "ar" | "fr" | "en", engine: ChemEngine): Promise<MadeRepresentation> {
  const molfile = drawingToMolfile(graph);
  const notes: RepresentationNote[] = [];
  let mol: MolGraph;
  let smiles = "";
  try {
    mol = await engine.fromMolfile(molfile);
    smiles = await engine.toSmiles(mol);
  } catch {
    mol = parseMolfile(molfile); // as drawn: its atoms in the order of the drawing, with its own coordinates
    notes.push("unchecked");
  }
  const drawn = drawingOnEngine(graph, mol);
  if (graph.atoms.some((a) => a.hidden && !drawn.map.atoms.has(a.id))) notes.push("unmasked"); // a mask that found no atom
  const pairs = graph.lonePairs ?? "off";
  // The school layout (an orthogonal drawing of one molecule) is for one molecule that the engine has checked: pieces that are
  // not bonded to each other (a dative arrow, a hydrogen bond, two molecules) or a sketch it could not read keep the drawing's own layout.
  const pieces = moleculesOf({ ...graph, bonds: graph.bonds.filter((b) => !NON_COVALENT_BONDS.includes(b.type)) }).length; // (what the engine was given)
  const layout = notes.includes("unchecked") || pieces > 1 ? "auto" : "school";
  const block: MoleculeBlockData = {
    schema: 1,
    source: { kind: "molfile", input: molfile, lang },
    smiles,
    graph: drawn.graph,
    representation: rep,
    options: { ...defaultRenderOptions(lang), layout, lonePairStyle: pairs === "lines" ? "lines" : "dots", showLonePairs: pairs !== "off" },
    edits: engineEdits(graph, drawn.graph, emptyEdits()),
    exerciseMode: view === "student" ? "student" : "answer",
    ...(drawn.overlay.length ? { overlayBonds: drawn.overlay } : {}),
  };
  const r = renderMolecule(block, view === "teacher" && maskedCount(graph) > 0 ? { ghost: true } : undefined);
  return { block, svg: r.svg, notes };
}

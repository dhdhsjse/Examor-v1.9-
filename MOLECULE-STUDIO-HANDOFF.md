# Molecule Studio: handoff for the next session

> Read this first, then `ARCHITECTURE.md` §13 (the "Molecule Studio" bullets) and `AGENTS.md`.
> Start the next session with: *"Read MOLECULE-STUDIO-HANDOFF.md and continue"* (Phase 4 is done; see §3 and §8 for what is left).
> Written 2026-10-22, updated the same day. Phases 0–4 are done. Phase 5 and v2 are later.

## 1. What this is

A **Molecule Studio** tool inside Examor (Next 16.4 static export + Tauri 2 + Konva). A teacher types a name, formula or SMILES, sees the molecule in school representations, edits what the student version shows, and inserts it in the worksheet as a block (student version, answer key, or both).

Real repo root: `Examor-v1.9--main\Examor-v1.9--main` (it has `.git`, `src-tauri`, `ARCHITECTURE.md`). The folder Claude Code was opened in (`...\Examor-v1.9--main\phylab`) is **empty**; work in the inner repo. There is also a stray nested `Examor-v1.9--main\Examor-v1.9--main\Examor-v1.9--main\.next` that breaks a full `npm run lint` (lint `app scripts` instead). The outer git index has `.next/` files staged; left alone. **Nothing has been committed.**

AGENTS.md warns that this Next.js differs from older ones: read `node_modules/next/dist/docs/` before touching routing or asset handling.

## 2. Decisions made with the user (do not re-litigate)

- **Look:** ChemDraw-style studio (palette, toolbars, grid canvas), **black and white for print**.
- **Scope:** v1 = generate, view, edit-for-exam (the original spec, Phases 0–5). **Drawing from scratch and reaction schemes (arrows, conditions text, brackets, "+" symbols, glassware) are v2.** The user wants it rich ("whatever a chemistry teacher needs, in one place") and scalable: the Studio canvas should become a scene of registered object types (molecule, text, arrow, bracket, symbol…) so v2 only adds modules. Drawn molecules must also feed Lewis / VSEPR / Cram and the student version.
- **UI:** standalone full-screen overlay that returns a block to the worksheet. A custom editor in v2 (not Ketcher).
- **Languages:** UI in Arabic (RTL), French, English.
- **Names:** English and French now. **Arabic molecule names come later from a list the user or a teacher supplies. Never invent Arabic chemistry names.** The only Arabic names in `data/molecules.json` are the two ethanoic-acid ones the spec itself gave; every entry is `reviewed: false`.
- **Engine:** RDKit.js (BSD-3) behind the `ChemEngine` interface (OpenChemLib was the compared alternative; pure JS 2.4 MB, no explicit-H-with-coordinates helper).
- **Block model:** a molecule is an `image` block carrying `ImageBlock.molecule` (`MoleculeBlockData`), exactly like a library `figure`. No new block type. `src` is the SVG drawing.
- **Dependencies added:** `@rdkit/rdkit`, `vitest@3` (vitest 5 conflicts with `@types/node@^20`), `tsx`. Permissive licenses only (`THIRD_PARTY_LICENSES.md`).

## 3. Status

| Phase | State |
|---|---|
| 0 explore + spike | done |
| 1 model, engine, lookup, molecular / semi-structural / structural, insert | done |
| 2 Lewis, VSEPR, edit layer, student / answer, Insert both | done |
| 3 Cram | done |
| 4 isomers (MAYGEN tables, school filter, classification, gallery) | done |
| 5 skeletal formula | **done** |
| 5 OPSIN fallback, stereoisomers, 3D ball-and-stick, Newman | later (not started) |
| v2 free-draw editor, reaction schemes, apparatus shapes | later (not started) |

Verified: 222 unit tests, `tsc`, `eslint app scripts` (0 errors; one pre-existing warning in `useExam.ts`), `npm run check:molecules` (57 molecules, 262 isomer tables), `npm run build` (exit 0), full browser flows (Edge via playwright-core against the static `out/` build) for Phases 1–4 and skeletal, including Arabic RTL, **and the real Tauri desktop app** (see below).

**Next.js was upgraded 16.4.0 → 16.4.2** (`next` and `eslint-config-next`, exact versions) on 2026-10-22: the registry lists two advisories for 16.0.0–16.4.0 (DoS in Server Actions, high; RCE in the image-optimisation API with SVG, critical) and 16.4.0's build step began failing on them (`SecurityFatalError`, exit 1). The app is a static export without a server, server actions or image optimisation, so it was not exposed at run time, but the build was blocked. 16.4.2 is a patch of the same minor; build, tests and all browser flows passed after it. To undo: set both back to `16.4.0` in `package.json` and `npm install` (it will fail the build again).

**Tauri verified (2026-10-22):** a debug build (`npx tauri build --debug --no-bundle`, ~2.5 min the first time; cargo is in `%USERPROFILE%\.cargo\bin`, not on PATH) was driven through WebView2's remote-debugging port with Playwright. The WASM engine loads inside Tauri (first drawing ~2.3 s), and lookup, Lewis, Cram, VSEPR, the isomer gallery (its data chunk), Insert both and the print preview all work, no console errors. Method in §7. **Still not verified:** the native "save file" dialog of a real PDF export (the preview uses the same render pipeline).

## 4. Commands

```
npm test                  # vitest, ~190 tests, ~2 s
npm run check:molecules   # validates molecules.json AND every isomer table against the current rules (~12 s)
npm run gen:isomers -- --jar /path/to/MAYGEN-1.8.jar [--only C2H4O2,C4H10] [--resume] [--max 30000] [--timeout 90]
                          # DEV MACHINE ONLY (Java). Regenerate after changing the school filter / classification / ranking rules.
                          # The jar: https://github.com/MehmetAzizYirik/MAYGEN/releases (MAYGEN-1.8.jar); keep it outside the repo.
                          # A full run takes ~25 min (the C6 formulas with Cl/N are the slow ones).
npx tsc --noEmit -p .
npx eslint app scripts
npm run build             # static export to out/ (predev/prebuild copy RDKit to public/rdkit)
```

## 5. Code map

Chemistry (plain TypeScript, **no React**) in `app/_molecule/`:

```
model.ts                 MoleculeBlockData, MolGraph, edits, RenderOptions, RenderContext (ghost)
chem.ts                  valence, lone pairs, Hill + display formula, rings, octetIssues
strings.ts               FR/AR UI strings + REP_LABEL (merged into uiStrings.ts by 2 lines at its end)
block.ts                 buildBlock(engine, candidate, source, lang)
engine/                  ChemEngine.ts, rdkitEngine.ts, molfile.ts (V2000 <-> graph), loadBrowser.ts
resolve/                 normalize.ts (Latin + Arabic + formulas), database.ts, resolve.ts, validate.ts
data/molecules.json      57 entries (alkanes..., acids, esters, amides, halogenoalkanes, aromatics, inorganics)
geometry/vsepr.ts        analyzeAtom + explainGeometry (ar/fr/en templates)
render/                  index.ts (registry), molecular, semiStructural, structural (+ buildScene/bondsSvg/atomsSvg/frame),
                         schoolLayout.ts, chain.ts, lewis.ts, lonePairs.ts, cram.ts, cramLayout.ts, blank.ts, svg.ts
edit/                    ops.ts (pure edit operations), history.ts, select.ts, selectionOps.ts
isomers/                 types.ts (+ GROUP / ISSUE / RELATION labels), groups.ts, school.ts, rank.ts, build.ts, describe.ts,
                         formulas.ts (which formulas get a table), load.ts (lazy loaders), validate.ts (CI)
data/isomers/            262 generated tables <formula>.json (1.7 MB) + generated index.ts: do not edit by hand
__tests__/               helpers.ts (blockFor, testEngine, FIXTURES) + one file per area, golden snapshots
```

UI in `app/_components/molecule/`: `MoleculeStudio.tsx` (shell), `useMoleculeEditor.ts` (history + selection + view), `EditCanvas.tsx` (select / rubber-band / drag), the redesigned UI (`MoleculeBrowser`, `Welcome`, `RepresentationBar`, `CanvasBar`, `SelectionToolbar`, `InspectorTabs` + `tabs/*`, `InsertBar`, `ui.tsx`, `layoutRules.ts`, `usePreviews.ts`; the old `InspectorPanel.tsx` is gone), `VseprPanel.tsx`, `PreviewStrip.tsx`, `IsomerGallery.tsx`, `useChemEngine.ts`, `moleculePreset.ts`.

App integration (the only edits to existing files):
- `app/_lib/types.ts`: `ImageBlock.molecule?`
- `app/_lib/tools.ts`: `ToolAction` gains `{kind:"molecule"}` and `{kind:"blocks", items}`
- `app/_components/Editor.tsx`: Studio state, double-click on a molecule block reopens it, page shortcuts off while open, `blocks` action places each block under the previous one
- `app/_features/core/types.ts`: `Shell.molecule / openMolecule / closeMolecule`
- `app/_features/tools/tool-molecule.tsx` (tile in the Physics and Sciences toolboxes), `overlays/overlay-molecule.tsx`, `bars/bar-overlays.ts`, `groups/group-physics.ts`, `groups/group-sciences.ts`
- `app/_lib/uiStrings.ts` (import + 2 `Object.assign` lines), `app/_components/icons.tsx` (`MoleculeIcon`), `eslint.config.mjs` (ignore `public/rdkit/**`), `package.json`, `scripts/` (`check-molecules.mts`, `copy-rdkit.mjs`), `public/rdkit/`

## 6. Things learned the hard way (avoid repeating)

- **Tool tiles need a `dragPayload`** (`ToolAction`); without it `FeatureRenderer` draws nothing. That is why the molecule tool has `{kind:"molecule"}`.
- **`addBlock` uses the document from the current render.** Two inserts in one tick land on the same spot; use the `blocks` action.
- **RDKit stereo:** writing 2D coordinates made RDKit invent cis/trans (`C/C=C/C`). `writeMolfile` marks double bonds "either" (stereo flag 3). Z/E is a Phase 5 feature.
- **`toSmiles` for H₂** returns empty after `remove_hs`; handled.
- **Ids are never reused:** every removal records `graph.nextAtom/nextBond` first (a test caught a violation).
- **A lookup effect must not depend on its own result.** It once re-fired every 250 ms and wiped edits. It now runs only on typed input (`typed` state).
- **Blank atoms:** the default `blankStyle` is `dashed-box`; `"stub"` makes blank look like hidden. A blank or hidden atom takes its lone pairs and charge with it.
- **Editor "ghost" view** always evaluates visibility as the student version, even while "Insert as: Answer key", so hidden things stay selectable (faded).
- **Selection CSS must be scoped** to `[data-testid="edit-canvas"]`; previews show the same atom ids.
- **Position edits (`edits.atoms[x,y]`) are shared across representations.** Cram ignores them and cannot be dragged.
- **Snapshots:** the Phase 1 golden snapshots pin molecular / semi-structural / structural only, so adding renderers does not change them. Lewis and Cram have their own snapshot tests.
- **Shell quoting:** big `node -e` / heredoc edits with template strings and regex repeatedly broke. Use the Edit / Write tools for code.
- **Dynamic labels are invisible to the string scan** (`t(REP_LABEL[r])`); a test now checks every registered tab has FR and AR names.
- Encoding: source files are UTF-8; PowerShell output shows mojibake for French/Arabic only on screen.

## 7. Browser and Tauri verification harness (recreate; the scratchpad is temporary)

**Testing the real Tauri window:** Tauri sets its own WebView2 arguments, so the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` env var is ignored. Build a throwaway test variant with a config override that is NOT committed: `npx tauri build --debug --no-bundle --config test.json` where `test.json` has `app.windows[0].additionalBrowserArgs = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=9222"` (and `decorations: true`). Run the exe with `WEBVIEW2_USER_DATA_FOLDER` set to a temp folder (so the test never touches the real app's autosaved exam), then `chromium.connectOverCDP("http://127.0.0.1:9222")`; the page is `http://tauri.localhost/`. Delete the exe and the temp profile afterwards (the exe has the debug port open).

**Browser (static `out/`):**

No browser tool is available; Edge exists at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
1. In a scratch folder: `npm i playwright-core` (and `@resvg/resvg-js` to rasterise SVG sheets).
2. A 15-line Node static server for `out/` (serve with `application/wasm` for `.wasm`).
3. Playwright `chromium.launch({executablePath: msedge, headless: true})`, viewport **1500×900** (the onboarding close button is at (1148, 239); in Arabic UI it is at (352, 251)). Close it, click "Subject:" → "Physics" → the "Molecule" tile, then type in the Studio search box.
4. Scope selectors to `getByTestId("edit-canvas")`; the left result previews reuse the same `data-atom-id`s. Other test ids: `selection-count`, `warnings`, `vsepr-text`, `preview-student`, `preview-answer`.
5. Visual check of renderers: a tsx script that renders the fixtures and a `Resvg` PNG sheet (it caught several layout issues the unit tests could not).

## 8. Open items and decisions for the user or a teacher

- **Arabic wording to be reviewed by a chemistry teacher:** representation tab names (الصيغة الجزيئية / نصف المفصّلة / المفصّلة / تمثيل لويس / تمثيل كرام), VSEPR geometry names, Arabic element names (e.g. الآزوت), the Arabic justification sentences, the functional-group names of the isomer gallery (حمض كربوكسيلي، إستر، ألدهيد، كيتون، كحول، إيثر، أمين، مشتق هالوجيني، ألكين، ألكاين…) and the isomer terms (I used the transliteration "إيزومر"; the curriculum may use another word), and all Arabic UI strings in `app/_molecule/strings.ts`. The user will supply Arabic molecule names later.
- Resolved this session (see §3): the Next.js advisory (upgraded to 16.4.2) and the Tauri verification. The user was told; nothing else is pending on them except the choices below.
- **One block or two?** The app has Exam and Correction views. One block could show the student version in Exam and the answer key in Correction, instead of "Insert both" (two blocks). Needs a canvas change (`BlockNode` image view gets the mode). Proposed, not built.
- Not built: an "Edit molecule" button in the image inspector (only double-click reopens), choosing the drop position of a new molecule, molecule previews in the toolbox search, a real PDF save through the native dialog (verified only up to the print preview).
- Known layout limits: a CH₃ Cram center next to a branch (isobutane) has two touching H labels; the school layout widens the chain bond next to a branch; rings use the engine's layout in the structural drawing and are "not supported yet" in semi-structural and Cram.
- The spec's isolated commit for the `types.ts` change and PR notes are not done (no commits yet).

## 9. Phase 4 (isomers): what was built and the choices in it

- **Pipeline:** `scripts/gen-isomers.mts` runs MAYGEN 1.8 (MIT, Java, a dev tool: not vendored, not shipped; added to `THIRD_PARTY_LICENSES.md`) for every formula in `isomers/formulas.ts`, canonicalises with the same RDKit path the app uses, and writes one JSON per formula (`total`, `schoolTotal`, entries: school ones first, DB molecules first, then simplest first; capped at 40 school + 20 other). Formulas with fewer than 2 structures or more than 30,000 get no table (e.g. `C6H11NO2` has 104,236). Names come **only** from the database (`ethanoic acid` etc.); no structure outside the database has a name.
- **Formula list (my choice, easy to change in `formulas.ts`):** all carbon formulas of the database plus C1–C6 with ≤2 O, ≤1 N, ≤2 Cl and ≤3 heteroatoms (4 for C1–C2), degree of unsaturation ≤3 (≤2 from C4), plus C7–C8 as C/H/O with d ≤ 1.
- **School filter** (`school.ts`): 3- and 4-membered rings, peroxides (H₂O₂ has its own DB entry and no table), enols (not phenols), gem-diols, cumulated double bonds (not CO₂). My additions to the spec's list: enols and gem-diols. Every molecule of the database passes it (a test).
- **Classification** is done in pure TypeScript on the graph, not with RDKit SMARTS (so it also works on an edited molecule at run time): `groups` (17 ids incl. `other`), `ring`, `branched`, `skeleton` (carbon-only canonical SMILES). **Deviation from the spec's entry shape:** there is no `class` field; chain / position / function isomerism is relative, so it is computed against the current molecule (`describe.ts#relation`): different groups → function; same groups + same skeleton → position; same groups + other skeleton → chain.
- **Runtime:** `data/isomers/index.ts` (generated) has one lazy loader per formula; `loadIsomers(formula)` accepts any spelling. `resolve()` adds the first 12 school isomers after the database molecules. The gallery (`IsomerGallery.tsx`) has the school toggle (default on), group / shape / relation chips, "Show more" paging (24 at a time), "N more not listed", reasons for non-school structures, the current molecule highlighted, and loads the chosen isomer into the Studio.
- **Acceptance (all checked by tests and in the browser):** `C2H4O2` → acetic acid, methyl methanoate, hydroxyacetaldehyde (3 school of 10); `C4H10` 2; `C4H10O` 4 alcohols + 3 ethers; alkane counts C5 3, C6 5, C7 9, C8 18.
- **Rules for future changes:** after touching `school.ts`, `groups.ts`, `rank.ts` or `build.ts`, regenerate with a full `npm run gen:isomers -- --jar …` (not `--resume`, which skips tables that exist) or `--only` for the affected formulas, then `npm run check:molecules` (it recomputes every flag with the current rules and fails on stale tables). `issues` are stored in a fixed order.
- Stereoisomers (Z/E, enantiomers) remain Phase 5: RDKit.js 2026.09 does **not** expose stereoisomer enumeration; precompute or skip.
- A test requires FR and AR strings for every registered tab, for every `t("...")` literal in `app/_components/molecule/*.tsx`, and for the group / issue / relation label maps; add translations (Arabic for teacher review) together with new UI.

## 10. Phase 5 and v2 (later)

Phase 5, done: **skeletal (line-angle) formula** (`render/skeletal.ts`, `skeletalLabels.ts`; the shared scene in `structural.ts` gained an implicit-carbon mode, hetero labels with their hydrogens, ring-aware double bonds). Design notes: carbons are bare vertices (still clickable via an invisible circle); a carbon is written only if charged, alone or cumulated (CO₂); hydrogens are written inside hetero labels on the side away from the bonds (`OH` / `HO`, `NH2` / `H2N`); a molecule with one heavy atom is written as its formula (`CH4`, `H2O`, `NH3`, `HCl`). **It needs a depiction made without hydrogens** (with them RDKit lays chains out straight), so `rdkitEngine.explicitH` now stores `MolAtom.sx / sy` (heavy atoms only); documents saved before this have none and fall back to `x, y` (straight chains). Like Cram it has its own layout (moves from other drawings do not apply, atoms cannot be dragged, no Layout / Hydrogens options). French "Formule topologique"; Arabic "الصيغة الهيكلية" is for teacher review.

Phase 5, not started: OPSIN name → structure fallback (Java sidecar via Tauri, optional, English only), stereoisomers (Z/E, enantiomers; RDKit.js cannot enumerate them), ball-and-stick (3D) and Newman renderers (the renderer interface allows them).

v2 (user's priorities): free-drawing editor on the same graph model (atom and bond tools, ring templates, wedge / hash bonds, text with auto-subscripts, align / distribute, clean-up, black-and-white print styles), reaction schemes (arrows incl. equilibrium and curved, conditions text above / below, brackets, charge and radical symbols, "+"), laboratory apparatus shapes, all as registered scene-object modules. The existing model (stable ids, `data-*-id` hit map, edit overlay, ops, local history) was kept editor-ready on purpose.

## 11. Original spec requirements still binding

- Chemistry code stays framework-free TypeScript; no `any` in the model or engine interface.
- Offline at runtime always: no CDN scripts, remote fonts or API calls.
- Chemistry correctness beats cosmetics: when something cannot be drawn, show an explicit message instead of a wrong drawing.
- Never invent chemical names, especially Arabic ones.
- At the end of each phase report: what was built, what was deferred, what was uncertain, what needs the product owner's or a teacher's decision.
- Adding a feature to the app = one new file + one array entry (ARCHITECTURE.md). Keep other file changes minimal and listed.

## UX redesign (October 2026)
The Studio was reorganised so a teacher sees one task at a time: empty state with popular molecules, browse-by-family, short representation names with a caption, a Select menu and floating selection toolbar, inspector tabs (Display / Exam / Geometry / Edit), and one primary Insert button with a split menu. All new strings have French and Arabic entries (the test `selection-and-strings.test.ts` also scans `tabs/` and the constant lists). Arabic wording of the new strings (tab names, family names, captions, tips) needs teacher review. The e2e scripts in the session scratchpad were updated for the new button names; they are not in the repo. Known nit: "1 parts changed" is not singularised.

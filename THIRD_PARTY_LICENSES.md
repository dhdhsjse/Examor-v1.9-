# Third-party licenses

Everything here is permissively licensed. Nothing is loaded from the network at run time.

| Package | Used for | License | Where |
|---|---|---|---|
| [@rdkit/rdkit](https://github.com/rdkit/rdkit-js) (RDKit.js, WASM build of RDKit) | Molecule Studio: parsing SMILES / molfiles, hydrogens, 2D coordinates, canonical SMILES | BSD-3-Clause | `public/rdkit/` (copied from `node_modules` by `scripts/copy-rdkit.mjs`) |
| [vitest](https://github.com/vitest-dev/vitest) | unit tests (dev only) | MIT | devDependency |
| [tsx](https://github.com/privatenumber/tsx) | runs `scripts/check-molecules.mts` and `scripts/gen-isomers.mts` (dev only) | MIT | devDependency |

## Used as a build-time tool, only its output is shipped

| Tool | Used for | License | Where |
|---|---|---|---|
| [MAYGEN](https://github.com/MehmetAzizYirik/MAYGEN) 1.8 (Java; relies on the Chemistry Development Kit) | generates the constitutional isomers of a molecular formula, run once on a developer machine by `scripts/gen-isomers.mts` | MIT (checked on the project's GitHub licence file, 2026-10-22) | not vendored and not shipped: the app contains only `app/_molecule/data/isomers/*.json`, files made from its output (canonicalised, classified and filtered by our own code). Java is never needed at run time. |

When MAYGEN's own dependencies are ever vendored or redistributed, check the CDK licence (LGPL) first; invoking the JAR as an external tool and keeping its output does not do that.

## Planned, not added yet (Molecule Studio, later phases)

- OPSIN (MIT), optional name → structure fallback.

// Loads RDKit.js from /public/rdkit in the browser and in the Tauri webview. Nothing is fetched from the
// network: the script and the .wasm are files of the app (copied to public/rdkit, see THIRD_PARTY_LICENSES).
import type { MainModule } from "@rdkit/rdkit";
import { createRdkitEngine } from "./rdkitEngine";
import type { ChemEngine } from "./ChemEngine";

declare global {
  interface Window {
    initRDKitModule?: (opts?: { locateFile?: (file: string) => string }) => Promise<MainModule>;
  }
}

const BASE = "/rdkit/";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadModule(): Promise<MainModule> {
  if (!window.initRDKitModule) await loadScript(`${BASE}RDKit_minimal.js`);
  if (!window.initRDKitModule) throw new Error("RDKit did not register itself");
  return window.initRDKitModule({ locateFile: (file) => BASE + file });
}

let shared: ChemEngine | null = null;

// One engine for the whole app: the WASM is loaded once, on first use.
export function getBrowserEngine(): ChemEngine {
  shared ??= createRdkitEngine(loadModule);
  return shared;
}

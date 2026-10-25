"use client";

import { useEffect, useState } from "react";
import { getBrowserEngine } from "@/app/_molecule/engine/loadBrowser";

type State = { status: "loading" } | { status: "ready" } | { status: "error"; error: string };

// Loads the chemistry engine (RDKit WASM) the first time the Studio opens; later openings are instant.
export function useChemEngine() {
  const engine = getBrowserEngine();
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    engine
      .init()
      .then(() => alive && setState({ status: "ready" }))
      .catch((e: unknown) => alive && setState({ status: "error", error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [engine]);
  return { engine, ...state };
}

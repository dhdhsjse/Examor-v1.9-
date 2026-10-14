"use client";

import dynamic from "next/dynamic";

// The editor uses the browser only (canvas, localStorage, files), so it is never pre-rendered.
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div className="grid h-screen place-items-center text-sm text-muted">Loading Exam Builder…</div>,
});

export default function ClientApp() {
  return <Editor />;
}

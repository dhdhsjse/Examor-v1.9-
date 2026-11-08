"use client";

import dynamic from "next/dynamic";
import { loadStart } from "@/app/_lib/storage";

// The editor uses the browser only (canvas, files), so it is never pre-rendered. The exam being worked on and the library are read
// (from the app's files) before it shows.
const Editor = dynamic(
  async () => {
    const [{ default: Editor }, start] = await Promise.all([import("./Editor"), loadStart()]);
    return function StartedEditor() {
      return <Editor start={start} />;
    };
  },
  {
    ssr: false,
    loading: () => <div className="grid h-screen place-items-center text-sm text-muted">Loading Exam Builder…</div>,
  },
);

export default function ClientApp() {
  return <Editor />;
}

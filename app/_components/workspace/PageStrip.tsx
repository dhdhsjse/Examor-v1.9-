"use client";

import { useState } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/app/_lib/a4";
import type { Block, Page } from "@/app/_lib/types";

const THUMB_W = 40;
const SCALE = THUMB_W / PAGE_WIDTH;
const STORAGE_KEY = "examBuilder.pageStripCollapsed";

interface Props {
  pages: Page[];
  blocks: Block[];
  heights: Map<string, number>;
  activeIndex: number;
  onJump: (index: number) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
}

// Read/save the collapsed state (localStorage can fail in some setups, so ignore errors).
function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function saveCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {}
}

// Slim column of page thumbnails between the toolbox and the page. Can be collapsed.
export default function PageStrip({ pages, blocks, heights, activeIndex, onJump, onAddPage, onDeletePage }: Props) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggle = () => {
    saveCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };

  return (
    <div
      className={`flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out ${
        collapsed ? "w-3" : "w-16"
      }`}
    >
      {/* Chevron toggle */}
      <button
        onClick={toggle}
        title={collapsed ? "Show pages" : "Hide pages"}
        className={`flex h-8 shrink-0 items-center justify-center text-faint hover:bg-subtle hover:text-ink ${
          collapsed ? "h-full items-start pt-2.5" : ""
        }`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
        >
          <path d="M6.5 2L3.5 5l3 3" />
        </svg>
      </button>

      {/* Thumbnails + add button (hidden while collapsed) */}
      <div
        className={`flex flex-1 flex-col items-center gap-2.5 overflow-x-hidden overflow-y-auto pb-3 transition-opacity duration-200 ${
          collapsed ? "pointer-events-none hidden opacity-0" : "opacity-100"
        }`}
      >
        {pages.map((page, i) => {
          const active = i === activeIndex;
          return (
            <div key={page.id} className="group relative flex flex-col items-center gap-0.5">
              <button
                onClick={() => onJump(i)}
                style={{ width: THUMB_W, height: PAGE_HEIGHT * SCALE }}
                className={`relative overflow-hidden rounded-[2px] bg-white shadow-sm ring-1 transition-all ${
                  active ? "ring-2 ring-indigo-500" : "ring-black/10 group-hover:ring-indigo-300"
                }`}
              >
                {/* Grey bars = blocks on this page */}
                {blocks
                  .filter((b) => b.layout.pageId === page.id)
                  .map((b) => (
                    <span
                      key={b.id}
                      className="absolute rounded-[1px] bg-slate-300"
                      style={{
                        left: b.layout.x * SCALE,
                        top: b.layout.y * SCALE,
                        width: b.layout.width * SCALE,
                        height: Math.max(1, (heights.get(b.id) ?? 0) * SCALE),
                      }}
                    />
                  ))}
              </button>
              <span className={`text-[10px] font-medium ${active ? "text-indigo-600" : "text-muted"}`}>{i + 1}</span>

              {/* Delete page (shown on hover, not for the last remaining page) */}
              {pages.length > 1 && (
                <button
                  onClick={() => onDeletePage(page.id)}
                  title="Delete page"
                  className="absolute -top-1.5 -right-1.5 hidden size-4 place-items-center rounded-full bg-white text-faint shadow ring-1 ring-black/10 group-hover:grid hover:text-red-600"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={onAddPage}
          title="Add page"
          className="grid h-7 w-10 shrink-0 place-items-center rounded border border-dashed border-slate-300 text-muted transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 6h7M6 2.5v7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

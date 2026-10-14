"use client";

import { useEffect, useState } from "react";

// Shared cache of loaded <img> elements (used by the canvas and the PDF export).
const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        cache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
    pending.set(src, p);
  }
  return p;
}

// Wait until all images are ready (before exporting a PDF).
export function preloadImages(srcs: string[]): Promise<unknown> {
  return Promise.allSettled(srcs.filter(Boolean).map(loadImage));
}

// React hook: returns the image once it is loaded (undefined before that).
export function useImage(src: string): HTMLImageElement | undefined {
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!src || cache.has(src)) return;
    let alive = true;
    loadImage(src)
      .then(() => alive && setLoaded((n) => n + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);
  return src ? cache.get(src) : undefined;
}

// Read a file the user picked as a data URL + its width/height ratio.
export async function readImageFile(file: File): Promise<{ src: string; ratio: number }> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await loadImage(src);
  return { src, ratio: img.naturalWidth / Math.max(1, img.naturalHeight) };
}

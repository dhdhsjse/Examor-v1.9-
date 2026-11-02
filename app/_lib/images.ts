"use client";

import { useEffect, useState } from "react";
import { pickFile } from "./storage";

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

// React hook: returns the image once it is loaded. Until then, the picture shown before it (a figure
// being redrawn keeps its old drawing instead of blinking), or undefined.
export function useImage(src: string): HTMLImageElement | undefined {
  const [, setLoaded] = useState(0);
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (!src || cache.has(src)) return;
    let alive = true;
    loadImage(src)
      .then(() => {
        if (!alive) return;
        setLoaded((n) => n + 1);
        setShown(src);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);
  return src ? (cache.get(src) ?? cache.get(shown)) : undefined;
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

const MAX_SIDE = 1600;

// A picture more than MAX_SIDE px across is drawn again smaller, in its own format and proportions: it is kept inside the exam (and its
// autosave), and a photo can be several megabytes. A vector picture is left as it is.
async function fitImage(src: string): Promise<string> {
  if (/^data:image\/svg/i.test(src)) return src;
  const img = await loadImage(src);
  const side = Math.max(img.naturalWidth, img.naturalHeight);
  if (side <= MAX_SIDE) return src;
  const k = MAX_SIDE / side;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return /^data:image\/jpe?g/i.test(src) ? canvas.toDataURL("image/jpeg", 0.9) : canvas.toDataURL("image/png");
}

// Let the user pick an image file: the picture (a data URL, made smaller if it is very big) and its proportions (null = none chosen, or a
// file that is not an image).
export async function pickImage(): Promise<{ src: string; ratio: number } | null> {
  const file = await pickFile("image/*");
  if (!file) return null;
  try {
    const { src, ratio } = await readImageFile(file);
    return { src: await fitImage(src), ratio };
  } catch {
    return null;
  }
}

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The same "@/…" import alias as tsconfig.json, so tests can load code that uses it (the layout code does, through the fonts).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});

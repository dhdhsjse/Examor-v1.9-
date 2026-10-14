import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: Tauri loads the built files from the `out` folder (no server).
  output: "export",
  // Tailwind CSS processing for Turbopack.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

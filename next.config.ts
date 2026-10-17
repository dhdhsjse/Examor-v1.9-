import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: Tauri loads the built files from the `out` folder (no server).
  output: "export",
  // The dev-tools "N" badge sat on top of the toolbar and the toolbox. Errors are still shown.
  devIndicators: false,
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

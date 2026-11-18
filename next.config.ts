import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e runs its own dev server with a separate build dir (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep the dev badge clear of the sidebar's "Switch Role" button.
  devIndicators: { position: "bottom-right" },
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

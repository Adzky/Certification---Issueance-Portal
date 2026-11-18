import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e runs its own dev server with a separate build dir (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep the dev badge clear of the sidebar's "Switch Role" button.
  devIndicators: { position: "bottom-right" },
  // Optional public base URL for certificate QR / verification links (empty = use the request origin).
  env: { PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "" },
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

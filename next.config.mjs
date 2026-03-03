import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Resolve the canonical yjs CJS/ESM entry via Node's require, which correctly
// walks node_modules. This deduplaces the module so @blocknote/core and y-partykit
// share one Yjs instance instead of creating two (which triggers the Yjs warning).
const yjsResolved = require.resolve("yjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.edgestore.dev",
      },
    ],
  },

  // ── Turbopack (next dev) — alias by package name, Turbopack resolves it ──
  turbopack: {
    resolveAlias: {
      yjs: "yjs",
    },
  },

  // ── Webpack (next build / production) ───────────────────────────────────
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: yjsResolved,
    };
    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Monorepo root (…/apps/web/next.config.mjs → …/), computed from this file so it
// is correct wherever the repo is checked out.
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Only pin the tracing root inside the Emergent dev container (where a stray
// /app/yarn.lock would otherwise be picked as the workspace root). On Vercel
// this path doesn't exist, so we leave the default — keeping builds portable.
const isEmergentDev = existsSync("/app/yarn.lock") && existsSync(path.join(monorepoRoot, "pnpm-lock.yaml"));

const nextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  // Workspace packages ship raw TypeScript — Next must compile them.
  transpilePackages: ["@bureau/api", "@bureau/ui", "@a2e/core"],
  ...(isEmergentDev ? { outputFileTracingRoot: monorepoRoot } : {}),
  // Allow the Emergent preview proxy origins and the production A2E Suite domain
  // during `next dev`. The browser is served from *.preview.emergentcf.cloud
  // (the real CDN origin) which proxies to *.preview.emergentagent.com — both
  // must be allowed or Next blocks the client JS chunks cross-origin and the app
  // gets stuck on the loader. `bureau.a2esuite.com` is included for dev against
  // the real production domain.
  // (allowedDevOrigins only applies in dev, so it's a no-op in production.)
  allowedDevOrigins: [
    "thread-flow-dev.preview.emergentagent.com",
    "thread-flow-dev.cluster-5.preview.emergentcf.cloud",
    "*.cluster-5.preview.emergentcf.cloud",
    "*.cluster-12.preview.emergentcf.cloud",
    "*.cluster-13.preview.emergentcf.cloud",
    "workspace-beta.preview.emergentagent.com",
    "workspace-beta.cluster-5.preview.emergentcf.cloud",
    "bureau.a2esuite.com",
    "*.bureau.a2esuite.com",
    ".preview.emergentagent.com",
    ".preview.emergentcf.cloud",
    ".emergentcf.cloud",
    ".emergentagent.com",
    "*.preview.emergentagent.com",
    "*.preview.emergentcf.cloud",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.convex.cloud" },
      { protocol: "https", hostname: "*.convex.site" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "customer-assets.emergentagent.com" },
      { protocol: "https", hostname: "bureau.a2esuite.com" },
      { protocol: "https", hostname: "*.bureau.a2esuite.com" },
    ],
  },
};

export default withNextIntl(nextConfig);

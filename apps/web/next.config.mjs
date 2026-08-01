/** @type {import('next').NextConfig} */
import { existsSync } from "fs";

// Only pin the tracing root inside the Emergent dev container (where a stray
// /app/yarn.lock would otherwise be picked as the workspace root). On Vercel
// this path doesn't exist, so we leave the default — keeping builds portable.
const isEmergentDev = existsSync("/app/yarn.lock") && existsSync("/app/texxel/pnpm-lock.yaml");

const nextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  // Workspace packages ship raw TypeScript — Next must compile them.
  transpilePackages: ["@bureau/api", "@bureau/ui", "@a2e/core"],
  ...(isEmergentDev ? { outputFileTracingRoot: "/app/texxel" } : {}),
  // Allow the Emergent preview proxy origins during `next dev`. The browser is
  // served from *.preview.emergentcf.cloud (the real CDN origin) which proxies
  // to *.preview.emergentagent.com — both must be allowed or Next blocks the
  // client JS chunks cross-origin and the app gets stuck on the loader.
  // (allowedDevOrigins only applies in dev, so it's a no-op in production.)
  allowedDevOrigins: [
    "thread-flow-dev.preview.emergentagent.com",
    "thread-flow-dev.cluster-5.preview.emergentcf.cloud",
    "*.cluster-5.preview.emergentcf.cloud",
    "*.cluster-12.preview.emergentcf.cloud",
    "*.cluster-13.preview.emergentcf.cloud",
    "texxel-collab.preview.emergentagent.com",
    "texxel-collab.cluster-12.preview.emergentcf.cloud",
    "texxel-collab.cluster-13.preview.emergentcf.cloud",
    "workspace-beta.preview.emergentagent.com",
    "workspace-beta.cluster-5.preview.emergentcf.cloud",
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
    ],
  },
};

export default nextConfig;

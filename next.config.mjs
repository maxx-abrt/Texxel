/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  turbopack: { root: "/app/frontend" },
  // Allow the Emergent preview proxy origin during `next dev`.
  allowedDevOrigins: [
    "flux-dashboard-2.preview.emergentagent.com",
    ".preview.emergentagent.com",
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

/**
 * A2E Core wiring for the web app.
 *
 * `CoreProvider` reads `NEXT_PUBLIC_CONVEX_CORE_URL` by itself and THROWS when it
 * is missing — which would take the whole app down on a misconfigured
 * environment. We resolve it here with the production core deployment as a
 * last-resort fallback (same pattern as the mobile app's `src/config.ts`).
 */
export const A2E_CORE_URL =
  process.env.NEXT_PUBLIC_CONVEX_CORE_URL || "https://superb-grasshopper-152.eu-west-1.convex.cloud";

/** True when the core URL came from the environment (i.e. not the hardcoded fallback). */
export const A2E_CORE_URL_FROM_ENV = Boolean(process.env.NEXT_PUBLIC_CONVEX_CORE_URL);

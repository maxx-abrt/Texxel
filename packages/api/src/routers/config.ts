import { publicProcedure, router } from "../trpc";

/**
 * Runtime configuration handed to the mobile app on boot so the Convex
 * deployment / app URL can change without shipping a new build.
 */
export const configRouter = router({
  get: publicProcedure.query(() => ({
    appName: "Bureau",
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL ?? null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
  })),
});

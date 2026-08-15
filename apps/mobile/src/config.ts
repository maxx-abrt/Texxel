/**
 * Bureau — runtime configuration.
 *
 * ⚠️  THIS IS THE ONE FILE TO EDIT WHEN THE DOMAIN CHANGES.
 * Everything else reads from here.
 *
 * Values come from `EXPO_PUBLIC_*` variables (see `apps/mobile/.env`) with a
 * production default, so a rebuild is not required to point a dev client at a
 * different backend — just change the env and restart Metro.
 */

/** Base URL of the Next.js app that hosts tRPC + the WorkOS hand-off routes. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://bureau.a2esuite.com").replace(/\/$/, "");

/**
 * Path prefix for the API routes.
 * The Next.js app exposes the same handlers under `/api` and `/next-api`.
 */
export const API_PREFIX = process.env.EXPO_PUBLIC_API_PREFIX ?? "/api";

/** Convex deployment the app subscribes to (same one as the web app). */
export const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://veracious-reindeer-573.eu-west-1.convex.cloud";

/** A2E Core deployment (shared workspaces/drive across the suite). */
export const CONVEX_CORE_URL =
  process.env.EXPO_PUBLIC_CONVEX_CORE_URL ?? "https://superb-grasshopper-152.eu-west-1.convex.cloud";

export const TRPC_URL = `${API_URL}${API_PREFIX}/trpc`;

/** WorkOS Client ID (public — safe to embed in the mobile app). */
export const WORKOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID ?? "client_01KVW89GASSRCG2KRX2ZB183QN";

/** WorkOS AuthKit authorization endpoint base. */
export const WORKOS_AUTHORIZE_URL = "https://api.workos.com/user_management/authorize";

export const APP_NAME = "Bureau";

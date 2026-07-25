import { handleAuth } from "@workos-inc/authkit-nextjs";

/**
 * Alternate AuthKit callback.
 *
 * Same handler as `/callback`; exists so a preview/staging deployment can use
 * `<origin>/api/callback` as its WorkOS redirect URI when only `/api/*` is
 * routed to the Next.js server. Unused in production.
 */
export const GET = handleAuth({ returnPathname: "/app" });

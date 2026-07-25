import { appRouter, createTRPCContext } from "@bureau/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const dynamic = "force-dynamic";

/**
 * tRPC endpoint shared by the web app and the Expo client.
 * Token-authenticated only (never cookies), so `*` CORS is safe and lets the
 * Expo web preview talk to it.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-trpc-source",
  "Access-Control-Max-Age": "86400",
};

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/next-api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    responseMeta: () => ({ headers: CORS_HEADERS }),
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { handler as GET, handler as POST };

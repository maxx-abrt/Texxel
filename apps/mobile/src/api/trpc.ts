import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";

import { TRPC_URL } from "@/src/config";
// Type-only import: erased at build time, so Metro never resolves outside the
// app directory. `tsconfig.json` maps `@bureau/api` to packages/api for tsc.
import type { AppRouter } from "@bureau/api";

let currentToken: string | null = null;

/** Called by the auth provider whenever a new access token is obtained. */
export function setTrpcAuthToken(token: string | null) {
  currentToken = token;
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      headers: () => (currentToken ? { authorization: `Bearer ${currentToken}` } : {}),
    }),
  ],
});

export function isUnauthorized(error: unknown): boolean {
  return error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
}

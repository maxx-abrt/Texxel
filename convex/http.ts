import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ─── Dev-auth JWKS (TESTING ONLY) ────────────────────────────────────────────
// Serves the public key for the dev auth bypass from the always-reachable
// convex.site domain, so token validation never depends on the Next.js app
// being up. Returns an empty key set unless DEV_AUTH_PUBLIC_JWK is configured
// (it must NOT be set in production).
http.route({
  path: "/dev/jwks",
  method: "GET",
  handler: httpAction(async () => {
    const jwk = process.env.DEV_AUTH_PUBLIC_JWK;
    const keys = jwk ? [JSON.parse(jwk)] : [];
    return new Response(JSON.stringify({ keys }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  }),
});

export default http;

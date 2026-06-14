// Convex auth providers.
// During the WorkOS migration we trust BOTH the current convex-auth tokens AND
// WorkOS AuthKit JWTs so nothing breaks while cutting over. Once WorkOS is fully
// wired and verified, the convex-auth provider line can be removed.
const clientId = process.env.WORKOS_CLIENT_ID ?? "";

const authConfig = {
  providers: [
    // Existing convex-auth (OIDC) — keep until WorkOS cutover is verified.
    { domain: process.env.CONVEX_SITE_URL, applicationID: "convex" },

    // WorkOS AuthKit — main issuer (per Convex docs).
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    // WorkOS AuthKit — user_management issuer.
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
};

export default authConfig;

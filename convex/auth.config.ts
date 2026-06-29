// ─── Convex auth providers ───────────────────────────────────────────────────
// WorkOS AuthKit issues RS256 access-token JWTs. Convex validates them as a
// `customJwt` provider using the WorkOS JWKS endpoint. The issuer is the
// APPLICATION-SCOPED issuer `https://api.workos.com/user_management/<CLIENT_ID>`
// (the bare `https://api.workos.com/` issuer is shared across apps and Convex
// refuses it without an `aud` check). `applicationID` (aud) is omitted — the
// user_management issuer is already unique per application, and WorkOS access
// tokens do not carry an `aud` claim by default.
//
// The WorkOS client id is PUBLIC, so we hardcode it (with an env fallback) to
// keep `convex deploy` working on any deployment without extra env wiring.
//
// This WorkOS environment has TWO client ids that share the same signing key
// (verified: both /sso/jwks/<id> endpoints return the identical key pair
// `sso_oidc_key_pair_01KVFSBW...`). AuthKit sign-in is configured under
// `01KVW89G`, but the user_management access tokens are issued with
// `iss = .../user_management/client_01KVFSBW...` (the environment's canonical
// User Management client). We therefore accept BOTH issuers so token validation
// succeeds regardless of which client id WorkOS stamps into `iss`.
const FALLBACK_CLIENT_IDS = [
  "client_01KVW89GASSRCG2KRX2ZB183QN",
  "client_01KVFSBWRCMSW7V0NB63DVQRHC",
];
const WORKOS_CLIENT_IDS = Array.from(
  new Set([
    ...(process.env.WORKOS_CLIENT_ID ? [process.env.WORKOS_CLIENT_ID] : []),
    ...FALLBACK_CLIENT_IDS,
  ]),
);

type Provider = {
  type: "customJwt";
  issuer: string;
  jwks: string;
  algorithm: "RS256";
  applicationID?: string;
};

const providers: Provider[] = WORKOS_CLIENT_IDS.map((id) => ({
  type: "customJwt",
  issuer: `https://api.workos.com/user_management/${id}`,
  jwks: `https://api.workos.com/sso/jwks/${id}`,
  algorithm: "RS256",
}));

// ─── Dev-only auth bypass (TESTING) ──────────────────────────────────────────
// Enabled ONLY when DEV_AUTH_ISSUER is set on the Convex deployment (never set
// it in production). Lets automated tests authenticate with a locally-minted
// RS256 token whose public JWKS is served by the Next.js app.
const DEV_AUTH_ISSUER = process.env.DEV_AUTH_ISSUER;
const DEV_AUTH_JWKS = process.env.DEV_AUTH_JWKS;
if (DEV_AUTH_ISSUER && DEV_AUTH_JWKS) {
  providers.push({
    type: "customJwt",
    issuer: DEV_AUTH_ISSUER,
    jwks: DEV_AUTH_JWKS,
    algorithm: "RS256",
  });
}

export default { providers };

import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

export type AuthedUser = {
  /** WorkOS user id (JWT `sub`). Matches `users.externalId` in Convex. */
  id: string;
  email: string | null;
  sessionId: string | null;
  /** WorkOS client id the token was issued for. */
  clientId: string;
};

export type TRPCContext = {
  req: Request;
  user: AuthedUser | null;
};

const WORKOS_ISSUER_PREFIX = "https://api.workos.com/user_management/";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(clientId: string) {
  let set = jwksCache.get(clientId);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`));
    jwksCache.set(clientId, set);
  }
  return set;
}

/**
 * Client ids allowed to authenticate against this backend.
 * This WorkOS environment exposes two ids that share one signing key, so both
 * the AuthKit client and the User Management client must be accepted.
 */
function allowedClientIds(): string[] {
  const raw = [process.env.WORKOS_CLIENT_ID, process.env.WORKOS_ALLOWED_CLIENT_IDS]
    .filter(Boolean)
    .join(",");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Verify a WorkOS access token.
 *
 * The issuer is application-scoped (`.../user_management/<clientId>`), so the
 * client id is read from `iss`, checked against the allow-list, and only then
 * used to pick the matching JWKS. Signature + `exp` are enforced by `jwtVerify`.
 */
export async function verifyWorkosAccessToken(token: string): Promise<AuthedUser | null> {
  let issuer: string;
  try {
    issuer = decodeJwt(token).iss ?? "";
  } catch {
    return null;
  }
  if (!issuer.startsWith(WORKOS_ISSUER_PREFIX)) return null;

  const clientId = issuer.slice(WORKOS_ISSUER_PREFIX.length);
  const allowed = allowedClientIds();
  if (allowed.length > 0 && !allowed.includes(clientId)) return null;

  try {
    const { payload } = await jwtVerify(token, jwksFor(clientId), { issuer });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      sessionId: typeof payload.sid === "string" ? payload.sid : null,
      clientId,
    };
  } catch {
    return null;
  }
}

export async function createTRPCContext({ req }: { req: Request }): Promise<TRPCContext> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return { req, user: null };
  const token = header.slice(7).trim();
  if (!token) return { req, user: null };
  return { req, user: await verifyWorkosAccessToken(token) };
}

// ─── Dev-only auth bypass helpers (TESTING ONLY) ────────────────────────────
// Mints short-lived RS256 JWTs and serves their public JWKS so the app can be
// exercised end-to-end without the full WorkOS SSO browser flow. Active only
// when DEV_AUTH_ENABLED=true AND a private key is configured. NEVER enable in
// production (do not set DEV_AUTH_ENABLED / DEV_AUTH_* on Vercel prod).
import { importPKCS8, SignJWT, type JWK } from "jose";
import { createPublicKey } from "crypto";

const PRIV_B64 = process.env.DEV_AUTH_PRIVATE_KEY_B64;
const KID = process.env.DEV_AUTH_KID ?? "flux-dev-key-1";
export const DEV_AUTH_ISSUER =
  process.env.DEV_AUTH_ISSUER ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

export function devAuthEnabled(): boolean {
  return process.env.DEV_AUTH_ENABLED === "true" && !!PRIV_B64 && !!DEV_AUTH_ISSUER;
}

async function privateKey() {
  const pem = Buffer.from(PRIV_B64!, "base64").toString("utf8");
  return importPKCS8(pem, "RS256");
}

export type DevUser = { sub: string; email: string; name?: string; picture?: string };

export function devUserFromEmail(email: string, name?: string): DevUser {
  // Deterministic external id from email so the same tester maps to one user.
  const slug = email.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  return { sub: `user_dev_${slug}`, email, name: name ?? email.split("@")[0] };
}

export async function mintDevToken(user: DevUser): Promise<string> {
  const key = await privateKey();
  return new SignJWT({ email: user.email, name: user.name, picture: user.picture })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(DEV_AUTH_ISSUER)
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(key);
}

export async function publicJwks(): Promise<{ keys: JWK[] }> {
  const pem = Buffer.from(PRIV_B64!, "base64").toString("utf8");
  const pubKey = createPublicKey(pem);
  const jwk = pubKey.export({ format: "jwk" }) as JWK;
  const pub: JWK = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", use: "sig", kid: KID };
  return { keys: [pub] };
}

export function encodeDevUser(u: DevUser): string {
  return Buffer.from(JSON.stringify(u)).toString("base64url");
}
export function decodeDevUser(raw: string): DevUser | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

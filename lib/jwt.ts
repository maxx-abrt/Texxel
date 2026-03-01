import type { KeyLike, JWK } from "jose";
import { SignJWT, importPKCS8, exportJWK, importSPKI } from "jose";

const PRIVATE_KEY_B64 = process.env.CONVEX_AUTH_PRIVATE_KEY!;
const PUBLIC_KEY_B64 = process.env.CONVEX_AUTH_PUBLIC_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const KID = "convex-bridge-key-1";

let _privateKey: KeyLike | null = null;
let _publicJwk: (JWK & Record<string, unknown>) | null = null;

async function getPrivateKey(): Promise<KeyLike> {
  if (_privateKey) return _privateKey;
  const pem = Buffer.from(PRIVATE_KEY_B64, "base64").toString("utf-8");
  _privateKey = (await importPKCS8(pem, "RS256")) as KeyLike;
  return _privateKey;
}

export async function getPublicJWKS() {
  if (_publicJwk) return { keys: [_publicJwk] };
  const pem = Buffer.from(PUBLIC_KEY_B64, "base64").toString("utf-8");
  const publicKey = await importSPKI(pem, "RS256");
  const jwk = await exportJWK(publicKey);
  _publicJwk = { ...jwk, kid: KID, alg: "RS256", use: "sig" };
  return { keys: [_publicJwk] };
}

export async function signConvexToken(user: {
  id: string;
  email?: string;
  name?: string;
  image?: string;
}): Promise<string> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.image,
  })
    .setProtectedHeader({ alg: "RS256", kid: KID, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1 hour
    .setIssuer(APP_URL)
    .sign(privateKey);

  return token;
}

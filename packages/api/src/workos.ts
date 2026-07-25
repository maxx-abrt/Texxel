import { WorkOS } from "@workos-inc/node";
import { sealData, unsealData } from "iron-session";

/**
 * Mobile session handling.
 *
 * The refresh token NEVER leaves the server in plaintext: it is sealed
 * (AES-GCM, `iron-session`) with `WORKOS_COOKIE_PASSWORD` — the same secret the
 * web app uses for its `wos-session` cookie — and the opaque blob is what the
 * mobile app stores in the device keychain. Every refresh returns a rotated
 * blob, mirroring WorkOS refresh-token rotation.
 */

export type MobileSession = {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id?: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePictureUrl?: string | null;
  } | null;
};

export type ResolvedMobileSession = {
  accessToken: string;
  expiresAt: number;
  sealed: string;
  user: {
    id: string | null;
    email: string | null;
    name: string | null;
    image: string | null;
  };
};

/** Refresh this many seconds before the access token actually expires. */
const REFRESH_BUFFER_SECONDS = 120;

function cookiePassword(): string {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password) throw new Error("Missing WORKOS_COOKIE_PASSWORD");
  return password;
}

function decodeExp(jwt: string): number | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64url").toString());
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function shapeUser(session: MobileSession, accessToken: string): ResolvedMobileSession["user"] {
  const u = session.user ?? null;
  let sub: string | null = u?.id ?? null;
  if (!sub) {
    try {
      const part = accessToken.split(".")[1];
      if (part) sub = JSON.parse(Buffer.from(part, "base64url").toString()).sub ?? null;
    } catch {
      sub = null;
    }
  }
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return {
    id: sub,
    email: u?.email ?? null,
    name: name.length > 0 ? name : null,
    image: u?.profilePictureUrl ?? null,
  };
}

export async function sealMobileSession(session: MobileSession): Promise<string> {
  return sealData(session, { password: cookiePassword() });
}

export async function unsealMobileSession(sealed: string): Promise<MobileSession> {
  return unsealData<MobileSession>(sealed, { password: cookiePassword() });
}

/**
 * Unseal a mobile session, refresh it against WorkOS when the access token is
 * close to expiry, and return a fresh access token plus a (possibly rotated)
 * sealed blob for the client to persist.
 *
 * Throws when the session can no longer be used — the client must sign in again.
 */
export async function resolveMobileSession(
  sealed: string,
  options: { force?: boolean } = {},
): Promise<ResolvedMobileSession> {
  const session = await unsealMobileSession(sealed);
  let accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
  if (!accessToken) throw new Error("invalid_session");

  const exp = decodeExp(accessToken);
  const nowSeconds = Date.now() / 1000;
  const stale = exp == null || nowSeconds > exp - REFRESH_BUFFER_SECONDS;

  if ((stale || options.force) && refreshToken) {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;
    if (apiKey && clientId) {
      try {
        const workos = new WorkOS(apiKey);
        const refreshed = await workos.userManagement.authenticateWithRefreshToken({
          clientId,
          refreshToken,
        });
        const next: MobileSession = {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          user: (refreshed.user as MobileSession["user"]) ?? session.user ?? null,
        };
        const nextSealed = await sealMobileSession(next);
        return {
          accessToken: refreshed.accessToken,
          expiresAt: (decodeExp(refreshed.accessToken) ?? nowSeconds + 300) * 1000,
          sealed: nextSealed,
          user: shapeUser(next, refreshed.accessToken),
        };
      } catch {
        // Rotation failed — fall through and reuse the current token if it is
        // still valid, otherwise surface an error so the app signs in again.
      }
    }
  }

  if (exp != null && nowSeconds >= exp) throw new Error("session_expired");

  return {
    accessToken,
    expiresAt: (exp ?? nowSeconds + 300) * 1000,
    sealed,
    user: shapeUser(session, accessToken),
  };
}

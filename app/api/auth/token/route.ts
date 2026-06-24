import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { WorkOS } from "@workos-inc/node";
import { devAuthEnabled, decodeDevUser, mintDevToken } from "@/lib/dev-auth";

type WosSession = {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
};

// Long-lived session cookie (400 days). The refresh token inside is rotated on
// every refresh, so as long as the user stays active (or the cookie persists)
// they remain signed in without surprise logouts.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days
// Refresh proactively while there is still time left, so the Convex client
// always receives a comfortably-valid token (avoids mid-request expiry).
const REFRESH_BUFFER_SECONDS = 120;

function decodeExp(jwt: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function needsRefresh(jwt: string): boolean {
  const exp = decodeExp(jwt);
  if (exp == null) return true;
  return Date.now() / 1000 > exp - REFRESH_BUFFER_SECONDS;
}

function sessionCookie(value: string): string {
  return `wos-session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

export async function GET() {
  const cookieStore = await cookies();

  // ── Dev auth bypass (TESTING ONLY) ──
  if (devAuthEnabled()) {
    const devRaw = cookieStore.get("dev-user")?.value;
    if (devRaw) {
      const user = decodeDevUser(devRaw);
      if (user) {
        try {
          const token = await mintDevToken(user);
          return Response.json({ token });
        } catch {
          /* fall through to WorkOS */
        }
      }
    }
  }

  // ── WorkOS session ──
  try {
    const raw = cookieStore.get("wos-session")?.value;
    if (!raw) return Response.json({ token: null });

    const session = await unsealData<WosSession>(raw, {
      password: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    let { accessToken, refreshToken } = session;
    if (!accessToken) return Response.json({ token: null });

    // Token still comfortably valid — return as-is.
    if (!needsRefresh(accessToken)) {
      return Response.json({ token: accessToken });
    }

    // Needs refresh — but if there is no refresh token we can still return the
    // current token while it is not strictly expired (last 2-min window).
    if (!refreshToken) {
      const exp = decodeExp(accessToken);
      if (exp != null && Date.now() / 1000 < exp) {
        return Response.json({ token: accessToken });
      }
      return Response.json({ token: null });
    }

    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    let refreshed;
    try {
      refreshed = await workos.userManagement.authenticateWithRefreshToken({
        clientId: process.env.WORKOS_CLIENT_ID!,
        refreshToken,
      });
    } catch {
      // Refresh failed (rotated/expired). If the access token is still valid for
      // a moment, hand it back rather than logging the user out abruptly.
      const exp = decodeExp(accessToken);
      if (exp != null && Date.now() / 1000 < exp) {
        return Response.json({ token: accessToken });
      }
      return Response.json({ token: null });
    }

    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;

    const newRaw = await sealData(
      { ...session, accessToken, refreshToken },
      { password: process.env.WORKOS_COOKIE_PASSWORD! },
    );
    const response = Response.json({ token: accessToken });
    response.headers.append("Set-Cookie", sessionCookie(newRaw));
    return response;
  } catch {
    return Response.json({ token: null });
  }
}

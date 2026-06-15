import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { WorkOS } from "@workos-inc/node";

type WosSession = {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
};

function isExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString()
    );
    return Date.now() / 1000 > (payload.exp ?? 0) - 10; // 10s buffer
  } catch {
    return true;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("wos-session")?.value;
    if (!raw) return Response.json({ token: null });

    const session = await unsealData<WosSession>(raw, {
      password: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    let { accessToken, refreshToken } = session;
    if (!accessToken) return Response.json({ token: null });

    // If the access token is still valid, return it immediately.
    if (!isExpired(accessToken)) {
      return Response.json({ token: accessToken });
    }

    // Access token expired — refresh it.
    if (!refreshToken) return Response.json({ token: null });
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    const refreshed = await workos.userManagement.authenticateWithRefreshToken({
      clientId: process.env.WORKOS_CLIENT_ID!,
      refreshToken,
    });
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;

    // Re-seal the updated session and write it back to the cookie.
    const newRaw = await sealData(
      { ...session, accessToken, refreshToken },
      { password: process.env.WORKOS_COOKIE_PASSWORD! }
    );
    const response = Response.json({ token: accessToken });
    response.headers.append(
      "Set-Cookie",
      `wos-session=${newRaw}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
    );
    return response;
  } catch {
    return Response.json({ token: null });
  }
}

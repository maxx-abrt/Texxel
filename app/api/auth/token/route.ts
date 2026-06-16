import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { WorkOS } from "@workos-inc/node";
import { devAuthEnabled, decodeDevUser, mintDevToken } from "@/lib/dev-auth";

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

    if (!isExpired(accessToken)) {
      return Response.json({ token: accessToken });
    }

    if (!refreshToken) return Response.json({ token: null });
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    const refreshed = await workos.userManagement.authenticateWithRefreshToken({
      clientId: process.env.WORKOS_CLIENT_ID!,
      refreshToken,
    });
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;

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

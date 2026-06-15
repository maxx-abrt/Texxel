import { WorkOS } from "@workos-inc/node";
import { sealData } from "iron-session";
import { cookies } from "next/headers";

// Custom callback: stores ONLY { accessToken, refreshToken } — not the full user
// object — to keep the wos-session cookie small (< 2 KB) and avoid Vercel's
// 8 KB request-header limit (494 REQUEST_HEADER_TOO_LARGE).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(new URL("/auth", request.url));

  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    const { accessToken, refreshToken } =
      await workos.userManagement.authenticateWithCode({
        code,
        clientId: process.env.WORKOS_CLIENT_ID!,
      });

    const sealed = await sealData(
      { accessToken, refreshToken },
      { password: process.env.WORKOS_COOKIE_PASSWORD! }
    );

    const cookieStore = await cookies();
    cookieStore.set("wos-session", sealed, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return Response.redirect(new URL("/app", request.url));
  } catch (err) {
    console.error("[callback] auth error", err);
    return Response.redirect(new URL("/auth", request.url));
  }
}

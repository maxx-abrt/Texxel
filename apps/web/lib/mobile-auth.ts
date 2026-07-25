import { cookies } from "next/headers";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { sealMobileSession, type MobileSession } from "@bureau/api";
import { unsealData } from "iron-session";

/**
 * WorkOS → Expo hand-off.
 *
 * Flow (no extra WorkOS redirect URI required — the existing web callback is
 * reused):
 *
 *   1. app  → GET /api/mobile/auth/start?redirect=bureau://auth
 *             stores `redirect` in a short-lived cookie, 302 → AuthKit
 *   2. WorkOS → GET /callback  (the app's already-registered redirect URI)
 *             authkit-nextjs writes the `wos-session` cookie, then 302s to the
 *             `returnPathname` we asked for
 *   3.        → GET /api/mobile/auth/handoff
 *             re-seals { accessToken, refreshToken, user } and 302s to
 *             `bureau://auth?session=<sealed>` — caught by expo-web-browser
 *
 * The sealed blob is opaque to the client; only this server can open it.
 */

const REDIRECT_COOKIE = "bureau-mobile-redirect";
const REDIRECT_COOKIE_MAX_AGE = 600; // 10 minutes

/** Custom schemes + local dev hosts allowed as a mobile hand-off target. */
const ALLOWED_SCHEMES = ["bureau:", "exp:", "exps:"];
const ALLOWED_LOCAL_HOSTS = ["localhost", "127.0.0.1"];

function extraAllowedOrigins(): string[] {
  return (process.env.MOBILE_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedMobileRedirect(target: string, requestUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }
  if (ALLOWED_SCHEMES.includes(parsed.protocol)) return true;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (ALLOWED_LOCAL_HOSTS.includes(parsed.hostname)) return true;
  if (parsed.origin === new URL(requestUrl).origin) return true;
  return extraAllowedOrigins().some((origin) => parsed.origin === origin);
}

/** `/api/mobile/auth/start` → `/api`, `/next-api/mobile/auth/start` → `/next-api`. */
function apiBasePath(requestUrl: string): string {
  return new URL(requestUrl).pathname.startsWith("/next-api") ? "/next-api" : "/api";
}

function isSecureRequest(requestUrl: string): boolean {
  try {
    return new URL(requestUrl).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export async function handleMobileAuthStart(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("redirect") ?? "";

  if (!target || !isAllowedMobileRedirect(target, request.url)) {
    return Response.json({ error: "invalid_redirect" }, { status: 400 });
  }
  if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID) {
    return Response.json({ error: "workos_not_configured" }, { status: 503 });
  }

  const signInUrl = await getSignInUrl({
    returnPathname: `${apiBasePath(request.url)}/mobile/auth/handoff`,
  });

  const secure = isSecureRequest(request.url) ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: signInUrl,
      "Cache-Control": "no-store",
      "Set-Cookie": `${REDIRECT_COOKIE}=${encodeURIComponent(target)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${REDIRECT_COOKIE_MAX_AGE}`,
    },
  });
}

export async function handleMobileAuthHandoff(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const rawRedirect = cookieStore.get(REDIRECT_COOKIE)?.value;
  const rawSession = cookieStore.get("wos-session")?.value;
  const secure = isSecureRequest(request.url) ? "; Secure" : "";
  const clearCookie = `${REDIRECT_COOKIE}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;

  const fail = (reason: string) =>
    new Response(failureHtml(reason), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": clearCookie },
    });

  if (!rawRedirect) return fail("missing_redirect");
  const target = decodeURIComponent(rawRedirect);
  if (!isAllowedMobileRedirect(target, request.url)) return fail("invalid_redirect");
  if (!rawSession) return fail("missing_session");

  let sealed: string;
  try {
    const session = await unsealData<MobileSession>(rawSession, {
      password: process.env.WORKOS_COOKIE_PASSWORD!,
    });
    if (!session.accessToken) return fail("missing_token");
    sealed = await sealMobileSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user ?? null,
    });
  } catch {
    return fail("seal_failed");
  }

  const separator = target.includes("?") ? "&" : "?";
  const location = `${target}${separator}session=${encodeURIComponent(sealed)}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Set-Cookie": clearCookie,
    },
  });
}

function failureHtml(reason: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in failed</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#faf6f2;color:#31302e;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
.c{max-width:340px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#7a746d;margin:0}code{font-size:12px;color:#8a3524}</style></head>
<body><div class="c"><h1>Sign-in could not complete</h1><p>Please close this window and try again.</p><p><code>${reason}</code></p></div></body></html>`;
}

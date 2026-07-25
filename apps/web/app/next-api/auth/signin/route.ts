import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { devAuthEnabled } from "@/lib/dev-auth";

export async function GET(request: Request) {
  if (devAuthEnabled()) return Response.redirect(new URL("/", request.url));
  if (!process.env.WORKOS_API_KEY || process.env.WORKOS_API_KEY.includes("...")) {
    return Response.json({ error: "WorkOS sign-in is not configured" }, { status: 503 });
  }
  const loginHint = new URL(request.url).searchParams.get("login_hint") || undefined;
  const signInUrl = await getSignInUrl({ loginHint });
  return Response.redirect(signInUrl);
}

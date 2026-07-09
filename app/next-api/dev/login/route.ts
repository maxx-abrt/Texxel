import { NextRequest, NextResponse } from "next/server";
import { devAuthEnabled, devUserFromEmail, encodeDevUser } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

// Dev-only sign-in. Sets a `dev-user` cookie that /api/auth/token turns into a
// freshly-minted RS256 token for Convex. GET (query) and POST (JSON) supported.
async function handle(email: string, name?: string) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: "dev auth disabled" }, { status: 403 });
  }
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const user = devUserFromEmail(email, name);
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set("dev-user", encodeDevUser(user), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const name = req.nextUrl.searchParams.get("name") ?? undefined;
  return handle(email, name);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handle(body.email ?? "", body.name);
}

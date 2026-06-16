import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@workos-inc/authkit-nextjs";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const hasWorkos = !!cookieStore.get("wos-session")?.value;

  // Dev bypass session: just clear the cookie and go home.
  if (!hasWorkos && cookieStore.get("dev-user")?.value) {
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.delete("dev-user");
    return res;
  }

  await signOut({ returnTo: "/" });
}

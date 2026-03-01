import { signConvexToken } from "@/lib/jwt";
import { NextRequest, NextResponse } from "next/server";

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;

export async function GET(request: NextRequest) {
  try {
    // Forward the Neon Auth session cookie to the upstream get-session endpoint
    const cookieHeader = request.headers.get("cookie") ?? "";
    if (!cookieHeader) {
      return NextResponse.json({ token: null }, { status: 401 });
    }

    const res = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
      headers: { Cookie: cookieHeader },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ token: null }, { status: 401 });
    }

    const data = await res.json();
    const user = data?.user;

    if (!user?.id) {
      return NextResponse.json({ token: null }, { status: 401 });
    }

    const token = await signConvexToken({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image ?? undefined,
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("[convex-token] Error:", error);
    return NextResponse.json({ token: null }, { status: 500 });
  }
}

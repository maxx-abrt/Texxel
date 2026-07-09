import { NextResponse } from "next/server";
import { devAuthEnabled, publicJwks } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

// Public JWKS for the dev auth bypass. Convex fetches this to validate dev JWTs.
export async function GET() {
  if (!devAuthEnabled()) {
    return NextResponse.json({ keys: [] }, { status: 200 });
  }
  const jwks = await publicJwks();
  return NextResponse.json(jwks, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

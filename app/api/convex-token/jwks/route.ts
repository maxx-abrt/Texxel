import { getPublicJWKS } from "@/lib/jwt";
import { NextResponse } from "next/server";

export async function GET() {
  const jwks = await getPublicJWKS();
  return NextResponse.json(jwks, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}

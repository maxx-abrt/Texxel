import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("dev-user");
  return res;
}
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("dev-user");
  return res;
}

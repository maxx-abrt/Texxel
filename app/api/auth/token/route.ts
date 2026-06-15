import { cookies } from "next/headers";
import { unsealData } from "iron-session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("wos-session")?.value;
    if (!raw) return Response.json({ token: null });
    const session = await unsealData<{ accessToken?: string }>(raw, {
      password: process.env.WORKOS_COOKIE_PASSWORD!,
    });
    return Response.json({ token: session.accessToken ?? null });
  } catch {
    return Response.json({ token: null });
  }
}

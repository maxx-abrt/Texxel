import { withAuth } from "@workos-inc/authkit-nextjs";

export async function GET() {
  const { accessToken } = await withAuth({ ensureSignedIn: false });
  return Response.json({ token: accessToken ?? null });
}

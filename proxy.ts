import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

export const config = {
  // Only run the proxy on the WorkOS auth routes.
  // Excluding /app/* prevents the proxy from attempting (and failing) a token
  // refresh on every page navigation, which would delete the wos-session cookie
  // and cause an infinite /app ↔ /auth redirect loop.
  matcher: ["/callback", "/auth", "/api/auth/:path*"],
};

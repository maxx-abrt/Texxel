import { auth } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";

const neonMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" });

export default async function middleware(request: NextRequest) {
  const response = await neonMiddleware(request);

  if (response && (response.status === 302 || response.status === 307)) {
    const location = response.headers.get("location");
    if (location?.includes("/auth/sign-in")) {
      const loginUrl = new URL(location);
      if (!loginUrl.searchParams.has("redirectTo")) {
        loginUrl.searchParams.set(
          "redirectTo",
          request.nextUrl.pathname + request.nextUrl.search,
        );
        const redirect = NextResponse.redirect(loginUrl);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === "set-cookie") {
            redirect.headers.append("set-cookie", value);
          }
        });
        return redirect;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/documents/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/teams/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/inbox/:path*",
    "/account/:path*",
    "/settings/:path*",
  ],
};

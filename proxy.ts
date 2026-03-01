import { auth } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";

const neonMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" });

const allowedOrigins = [
  "https://texxel.vercel.app",
  "https://www.texxel.app",
  "https://texxel.app",
];

function corsResponse(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export default async function middleware(request: NextRequest) {
  // Handle CORS preflight for auth routes
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 200 });
      const origin = request.headers.get("origin");
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, Cookie"
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");
      return response;
    }
    
    // Let auth routes pass through - Neon Auth handler will process them
    return corsResponse(request, NextResponse.next());
  }

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

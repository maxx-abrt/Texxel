import { redirect } from "next/navigation";
import { devAuthEnabled } from "@/lib/dev-auth";

// getSignInUrl() sets a PKCE cookie, so production delegates to a route handler.
// The isolated development auth bridge already owns the session and can enter
// the app directly without an RSC -> route-handler redirect loop.
export default function AuthPage() {
  redirect(devAuthEnabled() ? "/app" : "/next-api/auth/signin");
}

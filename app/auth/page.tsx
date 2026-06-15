import { redirect } from "next/navigation";

// getSignInUrl() sets a PKCE cookie — not allowed in Server Components (Next.js 16+).
// Delegate to the Route Handler at /api/auth/signin which runs in a permitted context.
export default function AuthPage() {
  redirect("/api/auth/signin");
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/**
 * Auto-redirects authenticated users from the public landing page to their
 * workspace (/documents). Kept as a tiny, side-effect-only component so the
 * rest of the landing tree can stay static/fast.
 */
export const AuthRedirect = () => {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const done = useRef(false);

  // Prefetch the workspace landing so the jump is instant once session resolves
  useEffect(() => {
    try { router.prefetch("/documents"); } catch {}
  }, [router]);

  useEffect(() => {
    if (done.current || isPending) return;
    if (session) {
      done.current = true;
      router.replace("/documents");
    }
  }, [session, isPending, router]);

  return null;
};

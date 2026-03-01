"use client";

import { ReactNode, useCallback } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { authClient } from "@/lib/auth/client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useNeonAuth() {
  const { data: session, isPending } = authClient.useSession();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        // Fetch an RS256 JWT from our bridge endpoint that Convex can validate
        const res = await fetch("/api/convex-token", {
          credentials: "include",
          cache: forceRefreshToken ? "no-store" : "default",
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.token ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  return {
    isLoading: isPending,
    isAuthenticated: !!session,
    fetchAccessToken,
  };
}

export const ConvexClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useNeonAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
};

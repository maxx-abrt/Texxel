"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { ToasterProvider } from "@/components/providers/toaster-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Bridges the WorkOS (or dev) session — exposed via /api/auth/token — to Convex.
// CRITICAL: `fetchAccessToken` MUST be a STABLE (useCallback) function and the
// returned object MUST be memoized, otherwise ConvexProviderWithAuth's internal
// effect re-runs on every render and the auth state never settles (infinite
// loader). The latest token is kept in a ref so the stable callback always
// returns the freshest value.
async function requestToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/token", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

function useWorkosAuth() {
  const [state, setState] = useState<{ isLoading: boolean; isAuthenticated: boolean }>({
    isLoading: true,
    isAuthenticated: false,
  });
  const tokenRef = useRef<string | null>(null);
  const lastFetch = useRef(0);

  useEffect(() => {
    let active = true;
    requestToken().then((t) => {
      if (!active) return;
      tokenRef.current = t;
      lastFetch.current = Date.now();
      setState({ isLoading: false, isAuthenticated: t != null });
    });
    return () => {
      active = false;
    };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const stale = Date.now() - lastFetch.current > 30_000;
      if (tokenRef.current == null || (forceRefreshToken && stale)) {
        const t = await requestToken();
        tokenRef.current = t;
        lastFetch.current = Date.now();
        setState((s) =>
          s.isAuthenticated === (t != null) ? s : { isLoading: false, isAuthenticated: t != null },
        );
      }
      return tokenRef.current;
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading: state.isLoading,
      isAuthenticated: state.isAuthenticated,
      fetchAccessToken,
    }),
    [state.isLoading, state.isAuthenticated, fetchAccessToken],
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkosAuth}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <LocaleProvider>
          {children}
          <ToasterProvider />
        </LocaleProvider>
      </ThemeProvider>
    </ConvexProviderWithAuth>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { ToasterProvider } from "@/components/providers/toaster-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useWorkosAuth() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/token");
      if (!res.ok) { setToken(null); return null; }
      const data = await res.json();
      const t = data.token ?? null;
      lastFetchRef.current = Date.now();
      setToken(t);
      return t;
    } catch {
      setToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    fetchToken().finally(() => { fetchingRef.current = false; });
  }, [fetchToken]);

  return {
    isLoading: token === undefined,
    isAuthenticated: token != null,
    fetchAccessToken: async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // Only hit the server if forced AND the last fetch was >30s ago.
      if (forceRefreshToken && Date.now() - lastFetchRef.current > 30_000) {
        return fetchToken();
      }
      return token ?? null;
    },
  };
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

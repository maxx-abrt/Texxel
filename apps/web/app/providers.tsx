"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { CoreProvider, WorkspaceProvider, type CoreTokenFetcher } from "@a2e/core";
import { A2E_CORE_URL } from "@/lib/core-config";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { ToasterProvider } from "@/components/providers/toaster-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Bridges the WorkOS (or dev) session — exposed via /next-api/auth/token — to Convex.
// CRITICAL: `fetchAccessToken` MUST be a STABLE (useCallback) function and the
// returned object MUST be memoized, otherwise ConvexProviderWithAuth's internal
// effect re-runs on every render and the auth state never settles (infinite
// loader). The latest token is kept in a ref so the stable callback always
// returns the freshest value.
async function requestToken(): Promise<string | null> {
  try {
    const res = await fetch("/next-api/auth/token", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

function decodeExpMs(jwt: string): number | null {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    lastFetch.current = Date.now();
    setState((s) =>
      s.isLoading === false && s.isAuthenticated === (t != null)
        ? s
        : { isLoading: false, isAuthenticated: t != null },
    );
    // Schedule a proactive background refresh shortly before the token expires
    // so the session stays alive and users are not logged out unexpectedly.
    if (timerRef.current) clearTimeout(timerRef.current);
    if (t) {
      const expMs = decodeExpMs(t);
      const now = Date.now();
      // refresh 90s before expiry, clamp to [20s, 10min]
      let delay = expMs ? expMs - now - 90_000 : 4 * 60_000;
      delay = Math.max(20_000, Math.min(delay, 10 * 60_000));
      timerRef.current = setTimeout(() => {
        requestToken().then(applyToken);
      }, delay);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestToken().then((t) => {
      if (!active) return;
      applyToken(t);
    });
    // Re-validate when the tab regains focus (handles long sleeps).
    const onFocus = () => {
      if (Date.now() - lastFetch.current > 60_000) {
        requestToken().then(applyToken);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [applyToken]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const expMs = tokenRef.current ? decodeExpMs(tokenRef.current) : null;
      const nearExpiry = expMs != null && expMs - Date.now() < 120_000;
      if (tokenRef.current == null || forceRefreshToken || nearExpiry) {
        const t = await requestToken();
        applyToken(t);
      }
      return tokenRef.current;
    },
    [applyToken],
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

// Stable token fetcher for the A2E Core client — reuses the same WorkOS
// session bridge (/next-api/auth/token); the endpoint always returns a fresh
// token server-side, so forceRefresh needs no special handling.
const coreFetchToken: CoreTokenFetcher = async () => requestToken();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkosAuth}>
      {/* Shared A2E core client (second Convex deployment) — same WorkOS token. */}
      <CoreProvider
        url={A2E_CORE_URL}
        fetchToken={coreFetchToken}
        routes={{
          drive: () => "/app/documents",
          event: (id) => `/app/calendar?event=${id}`,
          task: (id) => `/app/tasks?task=${id}`,
          contact: () => "/app/members",
          member: (id) => `/app/members?member=${id}`,
        }}
      >
        <WorkspaceProvider>
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
        </WorkspaceProvider>
      </CoreProvider>
    </ConvexProviderWithAuth>
  );
}

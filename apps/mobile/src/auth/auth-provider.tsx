import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { trpc } from "@/src/api/trpc";
import { isCodeProcessed, markCodeProcessed, resetCodeProcessed } from "@/src/auth/callback-guard";
import { WORKOS_AUTHORIZE_URL, WORKOS_CLIENT_ID } from "@/src/config";
import {
  adoptSealedSession,
  clearSession,
  getAccessToken,
  getSessionSnapshot,
  restoreSession,
  subscribeSession,
  type SessionUser,
} from "./session-store";

WebBrowser.maybeCompleteAuthSession();

type AuthValue = {
  /** `loading` until the keychain has been read and the token exchanged. */
  status: "loading" | "authenticated" | "unauthenticated";
  user: SessionUser | null;
  signingIn: boolean;
  /** Translation key of the last sign-in failure. */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await restoreSession();
      if (alive) setBootstrapped(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      const redirectUri = Linking.createURL("auth");
      const authUrl =
        `${WORKOS_AUTHORIZE_URL}` +
        `?response_type=code` +
        `&client_id=${WORKOS_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&provider=authkit`;
      resetCodeProcessed();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        preferEphemeralSession: false,
      });

      if (result.type !== "success" || !result.url) {
        if (result.type === "cancel" || result.type === "dismiss") return;
        setError("auth.errorInterrupted");
        return;
      }

      // On Android the redirect may have been handled by app/auth.tsx already.
      if (isCodeProcessed()) return;

      const code = Linking.parse(result.url).queryParams?.code;
      if (typeof code !== "string" || code.length === 0) {
        setError("auth.errorIncomplete");
        return;
      }

      markCodeProcessed();
      const res = await trpc.session.codeExchange.mutate({ code });
      const ok = await adoptSealedSession(res.sealed);
      if (!ok) {
        setError("auth.errorSession");
        return;
      }
    } catch {
      setError("auth.errorNetwork");
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status: bootstrapped ? session.status : "loading",
      user: session.user,
      signingIn,
      error,
      signIn,
      signOut,
    }),
    [bootstrapped, error, session.status, session.user, signIn, signOut, signingIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Bridge handed to `ConvexProviderWithAuth`.
 * `fetchAccessToken` is defined once at module scope so the identity never
 * changes between renders.
 */
const fetchAccessToken = async ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
  getAccessToken(forceRefreshToken);

export function useConvexAuthBridge() {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  return useMemo(
    () => ({
      isLoading: session.status === "loading",
      isAuthenticated: session.status === "authenticated",
      fetchAccessToken,
    }),
    [session.status],
  );
}

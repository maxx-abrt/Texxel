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
import { WORKOS_AUTHORIZE_URL, WORKOS_CLIENT_ID } from "@/src/config";
import { storage } from "@/src/utils/storage";
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

const DEMO_KEY = "bureau.demo";

export type AppMode = "live" | "demo";

type AuthValue = {
  /** `loading` until the keychain has been read and the token exchanged. */
  status: "loading" | "authenticated" | "unauthenticated";
  mode: AppMode;
  user: SessionUser | null;
  signingIn: boolean;
  /** Translation key of the last sign-in failure. */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  leaveDemo: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const [mode, setMode] = useState<AppMode>("live");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const demo = await storage.getItem<string>(DEMO_KEY, "");
      if (alive && demo === "1") setMode("demo");
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
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        preferEphemeralSession: false,
      });

      if (result.type !== "success" || !result.url) {
        if (result.type === "cancel" || result.type === "dismiss") return;
        setError("auth.errorInterrupted");
        return;
      }

      const code = Linking.parse(result.url).queryParams?.code;
      if (typeof code !== "string" || code.length === 0) {
        setError("auth.errorIncomplete");
        return;
      }

      const res = await trpc.session.codeExchange.mutate({ code });
      const ok = await adoptSealedSession(res.sealed);
      if (!ok) {
        setError("auth.errorSession");
        return;
      }
      setMode("live");
      void storage.setItem(DEMO_KEY, "0");
    } catch {
      setError("auth.errorNetwork");
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setMode("live");
    void storage.setItem(DEMO_KEY, "0");
  }, []);

  const enterDemo = useCallback(() => {
    setMode("demo");
    void storage.setItem(DEMO_KEY, "1");
  }, []);

  const leaveDemo = useCallback(() => {
    setMode("live");
    void storage.setItem(DEMO_KEY, "0");
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status: bootstrapped ? session.status : "loading",
      mode,
      user: session.user,
      signingIn,
      error,
      signIn,
      signOut,
      enterDemo,
      leaveDemo,
    }),
    [bootstrapped, enterDemo, error, leaveDemo, mode, session.status, session.user, signIn, signOut, signingIn],
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

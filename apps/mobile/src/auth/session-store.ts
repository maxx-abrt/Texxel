import { setTrpcAuthToken, trpc } from "@/src/api/trpc";
import { storage } from "@/src/utils/storage";

/**
 * Session store.
 *
 * A tiny external store (not React state) because Convex's
 * `ConvexProviderWithAuth` needs a *stable* `fetchAccessToken` that always
 * reads the freshest token — re-creating that callback on every render makes
 * the provider's effect loop and the app never leaves the loading state.
 */

export type SessionUser = {
  id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export type SessionSnapshot = {
  status: SessionStatus;
  user: SessionUser | null;
};

const SESSION_KEY = "bureau.session";

let sealed: string | null = null;
let accessToken: string | null = null;
let expiresAt = 0;
let inflight: Promise<string | null> | null = null;

let snapshot: SessionSnapshot = { status: "loading", user: null };
const listeners = new Set<() => void>();

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionSnapshot(): SessionSnapshot {
  return snapshot;
}

function publish(next: SessionSnapshot) {
  if (next.status === snapshot.status && next.user === snapshot.user) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function applyResult(result: { accessToken: string; expiresAt: number; sealed: string; user: SessionUser }) {
  accessToken = result.accessToken;
  expiresAt = result.expiresAt;
  sealed = result.sealed;
  setTrpcAuthToken(result.accessToken);
  void storage.secureSet(SESSION_KEY, result.sealed);
  publish({ status: "authenticated", user: result.user });
}

export async function clearSession(): Promise<void> {
  sealed = null;
  accessToken = null;
  expiresAt = 0;
  setTrpcAuthToken(null);
  await storage.secureRemove(SESSION_KEY);
  publish({ status: "unauthenticated", user: null });
}

/** Swap the opaque sealed blob for a short-lived access token via tRPC. */
async function exchange(blob: string, force: boolean): Promise<string | null> {
  try {
    const result = await trpc.session.exchange.mutate({ sealed: blob, force });
    applyResult(result);
    return result.accessToken;
  } catch {
    await clearSession();
    return null;
  }
}

/** Called once at boot from the auth provider. */
export async function restoreSession(): Promise<void> {
  const stored = await storage.secureGet<string>(SESSION_KEY, "");
  if (!stored || typeof stored !== "string") {
    publish({ status: "unauthenticated", user: null });
    return;
  }
  sealed = stored;
  const token = await exchange(stored, false);
  if (!token) publish({ status: "unauthenticated", user: null });
}

/** Persist the blob handed over by the WorkOS deep link. */
export async function adoptSealedSession(blob: string): Promise<boolean> {
  sealed = blob;
  return (await exchange(blob, false)) != null;
}

/**
 * Stable token getter handed to Convex. Reuses the cached token until it is
 * within 2 minutes of expiry, and de-duplicates concurrent refreshes.
 */
export async function getAccessToken(force = false): Promise<string | null> {
  if (!sealed) return null;
  const fresh = accessToken != null && Date.now() < expiresAt - 120_000;
  if (fresh && !force) return accessToken;
  if (!inflight) {
    inflight = exchange(sealed, force).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function currentAccessToken(): string | null {
  return accessToken;
}

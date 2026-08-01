/**
 * `localStorage` bridge for `@a2e/core` on React Native.
 *
 * `@a2e/core@0.2.0`'s `WorkspaceProvider` persists the active workspace through
 * `window.localStorage` (key `a2e_active_workspace`) — the same key the web app
 * uses, which is what makes "switch workspace in one app, switched everywhere"
 * work. React Native has no `localStorage`, so without this the selection is
 * in-memory only and resets on every cold start.
 *
 * Rather than forking the shared package (forbidden — the contract only ever
 * changes upstream in A2E-Core), we install a tiny synchronous `localStorage`
 * shim backed by AsyncStorage: hydrated once before the provider tree mounts,
 * then read synchronously and written through asynchronously.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Keys `@a2e/core` persists (see WorkspaceProvider's DEFAULT_STORAGE_KEY). */
const PERSISTED_KEYS = ["a2e_active_workspace"];

const cache = new Map<string, string>();
let hydrated = false;

function install() {
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  const target = (g.window ?? (globalThis as unknown as Record<string, unknown>)) as Record<string, unknown>;
  if (target.localStorage) return;

  target.localStorage = {
    getItem: (key: string) => (cache.has(key) ? cache.get(key)! : null),
    setItem: (key: string, value: string) => {
      cache.set(key, value);
      void AsyncStorage.setItem(key, value).catch(() => {});
    },
    removeItem: (key: string) => {
      cache.delete(key);
      void AsyncStorage.removeItem(key).catch(() => {});
    },
    clear: () => {
      const keys = [...cache.keys()];
      cache.clear();
      void AsyncStorage.multiRemove(keys).catch(() => {});
    },
    key: (index: number) => [...cache.keys()][index] ?? null,
    get length() {
      return cache.size;
    },
  };
}

/**
 * Loads the persisted values into the synchronous cache and installs the shim.
 * Safe to call multiple times; never throws.
 */
export async function hydrateCoreStorage(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const entries = await AsyncStorage.multiGet(PERSISTED_KEYS);
    for (const [key, value] of entries) {
      if (value != null) cache.set(key, value);
    }
  } catch {
    /* first launch / storage unavailable — start empty */
  }
  install();
}

// Client-only Zustand music store (§3.1 technical architecture).
//
// Holds normalized playback state, the queue, the active adapter identity
// and UI prefs. Persistence is limited to provider references, queue order,
// pins, last volume and UI preference — NEVER access tokens or provider
// cookies (§3.1). The live adapter instance itself is intentionally NOT in
// the store: it lives in a module singleton (see `getAdapter`) so a React
// remount can never destroy the player.

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  MusicProviderAdapter,
  MusicProviderId,
  MusicRef,
  MusicSnapshot,
  MusicTrackInfo,
} from "./types";
import { parseMusicUrl } from "./url";

export type MusicStatus = MusicSnapshot["state"];

interface QueueItem {
  ref: MusicRef;
  addedAt: number;
}

interface MusicStore {
  // ── normalized playback state (mirrored from the active adapter) ──
  status: MusicStatus;
  track: MusicTrackInfo | null;
  positionMs: number;
  volume: number;
  /** machine-readable reason for blocked/error status */
  reason: string | null;

  // ── queue / collections (persisted) ──
  queue: QueueItem[];
  currentIndex: number; // -1 = nothing loaded
  pinned: MusicRef[];
  recent: MusicRef[];

  // ── actions ──
  /** Parse a pasted url and either play it now or append to the queue.
   *  Returns a error-reason string for the UI, or null on success. */
  submitUrl: (url: string, opts?: { playNow?: boolean }) => Promise<string | null>;
  playAt: (index: number) => Promise<void>;
  togglePlay: () => void;
  seekTo: (positionMs: number) => void;
  setVolume: (volume: number) => void;
  removeFromQueue: (index: number) => void;
  /** Move the queue item at `from` to position `to`, remapping currentIndex
   *  so the playing track stays the playing track. */
  reorderQueue: (from: number, to: number) => void;
  togglePin: (ref: MusicRef) => void;
  clearQueue: () => void;
  /** Advance to the next queue item (wraps). Capability-gated in UI. */
  nextTrack: () => Promise<void>;
  /** Go to the previous queue item (wraps). Capability-gated in UI. */
  previousTrack: () => Promise<void>;
  /** Pause playback and clear the active item (mini-player "Dismiss").
   *  The queue, pins, recents and volume are preserved. */
  dismiss: () => void;
  /** Called by the active adapter's subscription. */
  _applySnapshot: (s: MusicSnapshot) => void;
}

// ── Adapter registry ────────────────────────────────────────────────────
// Only first-release providers (§3.1). The shell-level host
// (`music-player-host.tsx`) registers a factory per provider on mount —
// each factory closes over its stable host element, so the provider SDK
// module code stays out of the initial bundle (the host dynamic-imports
// the adapter module) and the player is never remounted by React.

type AdapterFactory = () => MusicProviderAdapter;
const factories = new Map<MusicProviderId, AdapterFactory>();
let activeAdapter: MusicProviderAdapter | null = null;
let activeKey: string | null = null; // ref key of the loaded item
let unsubscribe: (() => void) | null = null;

export function registerMusicAdapter(
  provider: MusicProviderId,
  factory: AdapterFactory,
) {
  factories.set(provider, factory);
}

function refKey(ref: MusicRef) {
  return `${ref.provider}:${ref.kind}:${ref.id}`;
}

async function ensureAdapter(
  provider: MusicProviderId,
): Promise<MusicProviderAdapter> {
  if (activeAdapter && activeAdapter.provider === provider) return activeAdapter;
  const factory = factories.get(provider);
  if (!factory) throw new Error(`no-adapter:${provider}`);
  unsubscribe?.();
  // Single audio focus (§3.1): starting one provider pauses the previous.
  try {
    activeAdapter?.pause();
  } catch {
    /* provider teardown must never break the switch */
  }
  activeAdapter = factory();
  return activeAdapter;
}

export const useMusicStore = create<MusicStore>()(
  persist(
    (set, get) => ({
      status: "idle",
      track: null,
      positionMs: 0,
      volume: 1,
      reason: null,
      queue: [],
      currentIndex: -1,
      pinned: [],
      recent: [],

      submitUrl: async (url, opts) => {
        const ref = parseMusicUrl(url);
        if (!ref) return "unsupported";
        const item: QueueItem = { ref, addedAt: Date.now() };
        const state = get();
        let index = state.queue.findIndex((q) => refKey(q.ref) === refKey(ref));
        if (index === -1) {
          set({ queue: [...state.queue, item] });
          index = get().queue.length - 1;
        }
        if (opts?.playNow === false) return null;
        try {
          await get().playAt(index);
          return null;
        } catch (e) {
          return e instanceof Error && e.message.startsWith("no-adapter:")
            ? "unsupported"
            : "error";
        }
      },

      playAt: async (index) => {
        const { queue } = get();
        const item = queue[index];
        if (!item) return;
        const adapter = await ensureAdapter(item.ref.provider);
        unsubscribe?.();
        unsubscribe = adapter.subscribe(get()._applySnapshot);
        const isNew = activeKey !== refKey(item.ref);
        set({
          currentIndex: index,
          status: "loading",
          reason: null,
          ...(isNew ? { track: null, positionMs: 0 } : {}),
        });
        activeKey = refKey(item.ref);
        try {
          await adapter.load(item.ref);
          adapter.setVolume?.(get().volume);
          adapter.play();
        } catch {
          set({ status: "error", reason: "load-failed" });
        }
        // Recents (most-recent first, deduped, capped at 20).
        const recent = [
          item.ref,
          ...get().recent.filter((r) => refKey(r) !== refKey(item.ref)),
        ].slice(0, 20);
        set({ recent });
      },

      togglePlay: () => {
        const { status } = get();
        if (!activeAdapter) return;
        if (status === "playing" || status === "buffering") {
          activeAdapter.pause();
        } else if (
          status === "paused" ||
          status === "ready" ||
          status === "ended"
        ) {
          activeAdapter.play();
        } else if (status === "blocked") {
          // Autoplay denial recovery is an explicit user gesture (§3.1) —
          // the UI wires its "Tap to play" button to this same action.
          activeAdapter.play();
        }
      },

      seekTo: (positionMs) => activeAdapter?.seek?.(positionMs),

      setVolume: (volume) => {
        const v = Math.min(1, Math.max(0, volume));
        set({ volume: v });
        activeAdapter?.setVolume?.(v);
      },

      removeFromQueue: (index) => {
        const { queue, currentIndex } = get();
        const next = queue.filter((_, i) => i !== index);
        let nextIndex = currentIndex;
        if (index < currentIndex) nextIndex = currentIndex - 1;
        else if (index === currentIndex) nextIndex = -1;
        set({ queue: next, currentIndex: nextIndex });
      },

      reorderQueue: (from, to) => {
        const { queue, currentIndex } = get();
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= queue.length ||
          to >= queue.length
        )
          return;
        const next = [...queue];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        let nextIndex = currentIndex;
        if (currentIndex === from) nextIndex = to;
        else if (from < currentIndex && to >= currentIndex) nextIndex = currentIndex - 1;
        else if (from > currentIndex && to <= currentIndex) nextIndex = currentIndex + 1;
        set({ queue: next, currentIndex: nextIndex });
      },

      togglePin: (ref) => {
        const key = refKey(ref);
        const pinned = get().pinned;
        set({
          pinned: pinned.some((p) => refKey(p) === key)
            ? pinned.filter((p) => refKey(p) !== key)
            : [ref, ...pinned].slice(0, 50),
        });
      },

      clearQueue: () => set({ queue: [], currentIndex: -1 }),

      nextTrack: async () => {
        const { queue, currentIndex } = get();
        if (queue.length === 0) return;
        await get().playAt(currentIndex < 0 ? 0 : (currentIndex + 1) % queue.length);
      },

      previousTrack: async () => {
        const { queue, currentIndex } = get();
        if (queue.length === 0) return;
        const prev = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
        await get().playAt(prev);
      },

      dismiss: () => {
        // Explicit user dismissal (§3.1 #4 island Dismiss). Pauses the live
        // adapter but keeps the queue/pins/recents for a one-tap resume.
        try {
          activeAdapter?.pause();
        } catch {
          /* teardown must never break dismissal */
        }
        set({ currentIndex: -1, status: "idle", track: null, positionMs: 0, reason: null });
      },

      _applySnapshot: (s) => {
        set({
          status: s.state,
          track: s.track,
          positionMs: s.positionMs ?? get().positionMs,
          reason: s.reason ?? null,
        });
      },
    }),
    {
      name: "bureau-music",
      storage: createJSONStorage(() => localStorage),
      // §3.1 — persist only provider refs, queue order, pins, last volume
      // and UI preference. Never playback state, tokens or cookies.
      partialize: (s) => ({
        queue: s.queue,
        currentIndex: s.currentIndex,
        pinned: s.pinned,
        recent: s.recent,
        volume: s.volume,
      }),
    },
  ),
);

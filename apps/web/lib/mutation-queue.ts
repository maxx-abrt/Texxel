"use client";

import { useCallback, useSyncExternalStore } from "react";

// Mutation queue / retry helper (§1.1 "Real-time & reconnect status").
//
// Convex already retries mutations automatically when the WebSocket
// reconnects — the promises returned by `useMutation` simply resolve later.
// This module adds a thin **client-side tracking layer** so the UI can show
// "N changes queued locally" while offline and confirm the flush on
// reconnect. It is intentionally framework-agnostic (no React import) so it
// can be used from any component or hook.
//
// Usage:
//   const queue = useMutationQueue();
//   const result = queue.track(myMutation({ ... }));
//
// The tracked promise resolves/rejects exactly as the underlying mutation
// does — `track` is a pass-through that just counts outstanding calls.

type Listener = (depth: number) => void;

let depth = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn(depth);
}

/** Subscribe to queue-depth changes. Returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Current number of outstanding tracked mutations. */
export function getQueueDepth(): number {
  return depth;
}

/**
 * Wrap a mutation promise so it is counted in the offline queue depth.
 * Pass-through: the returned promise resolves/rejects with the same value
 * as the input promise. Safe to call while online too (depth just flickers
 * briefly).
 */
export function track<T>(promise: Promise<T>): Promise<T> {
  depth += 1;
  notify();
  const settle = () => {
    depth = Math.max(0, depth - 1);
    notify();
  };
  promise.then(settle, settle);
  return promise;
}

/** Reset the queue (called on full reconnect to clear stale state). */
export function resetQueue(): void {
  if (depth === 0) return;
  depth = 0;
  notify();
}

// ── React hook ──────────────────────────────────────────────────────────

/** React hook that returns the current offline mutation queue depth. */
export function useMutationQueue(): {
  depth: number;
  track: <T>(promise: Promise<T>) => Promise<T>;
} {
  const value = useSyncExternalStore(
    subscribe,
    getQueueDepth,
    getQueueDepth, // server snapshot — 0
  );
  const trackFn = useCallback(<T,>(promise: Promise<T>) => track(promise), []);
  return { depth: value, track: trackFn };
}

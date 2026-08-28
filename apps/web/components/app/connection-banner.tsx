"use client";

// Connection status banner (§1.1 "Real-time & reconnect status").
//
// Slim amber strip shown at the top of the content zone when the Convex
// WebSocket drops. Mirrors Huly's transactor connection UX: "Reconnecting…
// changes are queued locally." The banner is purely informational — Convex
// already retries mutations automatically; the queue depth (from
// lib/mutation-queue) is surfaced as "N changes queued" when > 0.
//
// The banner only appears *after* the first successful connection
// (`hasEverConnected`) so the initial auth/loading screen is not cluttered.

import { useEffect } from "react";
import { useConvexConnectionState } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CloudChange } from "iconsax-reactjs";
import { useMutationQueue, resetQueue } from "@/lib/mutation-queue";

export function ConnectionBanner() {
  const state = useConvexConnectionState();
  const { depth } = useMutationQueue();
  const t = useTranslations("connection");

  // isWebSocketConnected may be undefined on first render (before the client
  // reports state). Treat undefined as "not yet connected" but only show the
  // banner once we've connected at least once.
  const isConnected = state?.isWebSocketConnected ?? false;
  const hasEverConnected = state?.hasEverConnected ?? false;
  const show = hasEverConnected && !isConnected;

  // Clear the queue depth once we're fully reconnected and no mutations are
  // outstanding — prevents a stale "N queued" from lingering.
  useEffect(() => {
    if (isConnected && depth === 0) resetQueue();
  }, [isConnected, depth]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
          data-testid="connection-banner"
          data-connected={isConnected}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-white">
            <CloudChange variant="Bold" size={16} className="shrink-0 animate-pulse" />
            <span className="flex-1 truncate">{t("reconnecting")}</span>
            {depth > 0 && (
              <span
                className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold tabular-nums"
                data-testid="connection-queue-depth"
              >
                {t("queued", { count: depth })}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

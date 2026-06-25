"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export type PresenceUser = {
  userId: string;
  name: string | null;
  image: string | null;
  state: string; // "viewing" | "editing"
  lastSeen: number;
};

/**
 * Real-time document presence. Sends a heartbeat on mount and every ~8s,
 * removes the presence row on unmount/navigation, and subscribes to the
 * live list of active collaborators on the document.
 */
export function usePresence(
  documentId: Id<"flux_documents"> | undefined,
  editing: boolean,
): PresenceUser[] {
  const heartbeat = useMutation(api.flux_presence.heartbeat);
  const leave = useMutation(api.flux_presence.leave);
  const presence = useQuery(
    api.flux_presence.listForDocument,
    documentId ? { documentId } : "skip",
  ) as PresenceUser[] | undefined;

  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Heartbeat loop + cleanup.
  useEffect(() => {
    if (!documentId) return;
    let active = true;
    const beat = () => {
      if (!active) return;
      heartbeat({
        documentId,
        state: editingRef.current ? "editing" : "viewing",
      }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 8000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    const onUnload = () => {
      leave({ documentId }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      leave({ documentId }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Reflect editing-state transitions immediately (caller debounces this).
  useEffect(() => {
    if (!documentId) return;
    heartbeat({
      documentId,
      state: editing ? "editing" : "viewing",
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, documentId]);

  return presence ?? [];
}

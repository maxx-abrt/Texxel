"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { usePresence as useCorePresence } from "@a2e/core";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";
import { coreFlags } from "@/lib/core-flags";

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
 *
 * When the core presence flag is ON, uses the shared A2E Core presence
 * system (cross-app). Otherwise uses the local flux_presence table.
 */
export function usePresence(
  documentId: Id<"flux_documents"> | undefined,
  editing: boolean,
): PresenceUser[] {
  const coreWsId = useCoreWorkspaceId();
  const useCore = coreFlags.presence;

  // Local path
  const heartbeat = useMutation(api.flux_presence.heartbeat);
  const leave = useMutation(api.flux_presence.leave);
  const localPresence = useQuery(
    api.flux_presence.listForDocument,
    !useCore && documentId ? { documentId } : "skip",
  ) as PresenceUser[] | undefined;

  // Core path
  const corePresence = useCorePresence(
    useCore && coreWsId ? (coreWsId as never) : null,
    useCore && documentId ? { type: "document", id: String(documentId) } : null,
    editing ? "editing" : "viewing",
  );

  // Normalize core presence to local shape
  const presence: PresenceUser[] | undefined = useCore
    ? (corePresence ?? []).map((p) => ({
        userId: String(p.userId),
        name: p.user?.name ?? null,
        image: p.user?.image ?? null,
        state: p.state,
        lastSeen: p.lastSeen,
      }))
    : localPresence;

  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Heartbeat loop + cleanup (local path only — core hook handles its own).
  useEffect(() => {
    if (useCore || !documentId) return;
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
  }, [documentId, useCore]);

  // Reflect editing-state transitions immediately (local path only).
  useEffect(() => {
    if (useCore || !documentId) return;
    heartbeat({
      documentId,
      state: editing ? "editing" : "viewing",
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, documentId, useCore]);

  return presence ?? [];
}

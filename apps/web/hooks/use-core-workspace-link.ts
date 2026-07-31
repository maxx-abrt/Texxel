"use client";

import { useAction, useMutation } from "convex/react";
import { useCoreMutation, coreApi } from "@a2e/core";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Dual-write helpers for workspace create/rename flows (Pattern B).
 *
 * Both helpers are best-effort: a failure never blocks the local flow — the
 * WorkspaceLinkBridge re-heals the link/drift on the next login (name
 * heuristic for unstamped creates, core-canonical name for failed renames).
 */
export function useCoreWorkspaceLink() {
  const stampCoreId = useMutation(api.coreSync.stampCoreId);
  const importLocalMembers = useAction(api.coreSync.importLocalMembers);
  const createCoreWorkspace = useCoreMutation(coreApi.workspaces.create);
  const updateCoreWorkspace = useCoreMutation(coreApi.workspaces.update);

  /**
   * Create the core twin of a freshly created local workspace (user token),
   * stamp `coreId` (ownership re-verified server-side), then import the other
   * local members via the service bridge. Returns the core id, or null when
   * the link failed (the bridge will retry by name on next login).
   */
  const linkNewWorkspace = async (
    localWorkspaceId: Id<"workspaces">,
    args: { name: string; type?: string; locale?: string; currency?: string },
  ): Promise<string | null> => {
    try {
      const coreId = await createCoreWorkspace({
        name: args.name,
        ...(args.type === "business" || args.type === "association"
          ? { type: args.type }
          : {}),
        ...(args.locale ? { locale: args.locale } : {}),
        ...(args.currency ? { currency: args.currency } : {}),
      });
      await stampCoreId({ localWorkspaceId, coreId });
      await importLocalMembers({ localWorkspaceId }).catch(() => undefined);
      return coreId as string;
    } catch (err) {
      console.error("[a2e] core link failed (bridge will heal on next login):", err);
      return null;
    }
  };

  /** Propagate a rename to the linked core workspace. Fire-and-forget. */
  const pushRename = async (
    coreId: string | undefined,
    name: string,
  ): Promise<void> => {
    if (!coreId) return;
    try {
      await updateCoreWorkspace({ workspaceId: coreId as never, name });
    } catch (err) {
      console.error("[a2e] core rename failed (next sync heals drift):", err);
    }
  };

  return { linkNewWorkspace, pushRename };
}

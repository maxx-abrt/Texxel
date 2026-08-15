"use client";

import * as React from "react";
import { useWorkspace as useCoreWorkspace } from "@a2e/core";
import { useWorkspace } from "@/hooks/use-flux-workspace";

/**
 * The workspace id to use for **A2E Core** calls.
 *
 * Bureau follows Pattern B (linked mirror): every local workspace can carry a
 * `coreId` pointing at the shared core workspace (stamped by the
 * WorkspaceLinkBridge). Core functions validate `v.id("workspaces")` against the
 * CORE deployment and assert membership there — so passing this app's local
 * workspace id makes every core query fail with a server error
 * ("Forbidden: you are not a member of this workspace"), which is exactly what
 * used to blow up `Q(tasks:list)`.
 *
 * This hook returns the linked core id **only when the signed-in user really is
 * a member of it in core** (verified against core's own `workspaces.listMine`),
 * and `null` otherwise — callers then skip their core queries and fall back to
 * local data instead of crashing.
 *
 * It also keeps core's active-workspace selection aligned with the local one, so
 * switching workspace in Bureau switches it for the whole suite (shared
 * `a2e_active_workspace` key).
 */
export function useCoreWorkspaceId(): string | null {
  const { activeWorkspace } = useWorkspace();
  const {
    activeWorkspaceId: coreActiveId,
    workspaces: coreWorkspaces,
    setActiveWorkspaceId,
  } = useCoreWorkspace();

  const linkedId = activeWorkspace?.coreId ?? null;

  // Only trust the link once core confirms the membership (the list is undefined
  // while loading → treat as "not ready", never send a speculative id).
  const memberOfLinked = React.useMemo(
    () => Boolean(linkedId && coreWorkspaces?.some((w) => w._id === linkedId)),
    [linkedId, coreWorkspaces],
  );

  React.useEffect(() => {
    if (memberOfLinked && linkedId && coreActiveId !== linkedId) {
      setActiveWorkspaceId(linkedId as never);
    }
  }, [memberOfLinked, linkedId, coreActiveId, setActiveWorkspaceId]);

  return memberOfLinked ? linkedId : null;
}

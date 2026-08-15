"use client";

import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";

/**
 * Mounted once in the app shell: keeps A2E Core's active-workspace selection
 * aligned with Bureau's local one (via the local workspace's `coreId`).
 *
 * Two effects:
 *  - every component that reads core's `useWorkspace()` gets the workspace the
 *    user is actually looking at here;
 *  - the shared `a2e_active_workspace` key is updated, so switching workspace in
 *    Bureau switches it in Bilan / Drive / the other suite apps too.
 */
export function CoreWorkspaceSync() {
  useCoreWorkspaceId();
  return null;
}

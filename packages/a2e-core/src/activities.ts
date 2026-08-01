"use client"

import { useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { ActivityDoc, Id } from "./types"

export function useActivities(workspaceId?: Id<"workspaces"> | null, limit?: number): ActivityDoc[] | undefined {
  return useCoreQuery(coreApi.activities.list, workspaceId ? { workspaceId, limit } : "skip")
}

/** GDPR export of every core row scoped to the workspace (owner/admin only). */
export function useWorkspaceExport(workspaceId?: Id<"workspaces"> | null, enabled = false) {
  return useCoreQuery(coreApi.activities.exportWorkspace, workspaceId && enabled ? { workspaceId } : "skip")
}

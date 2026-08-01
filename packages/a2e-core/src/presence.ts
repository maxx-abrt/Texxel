"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { Id, PresenceUser } from "./types"

const HEARTBEAT_MS = 8_000

/** Heartbeats while mounted, leaves on unmount; returns the currently active users. */
export function usePresence(
  workspaceId: Id<"workspaces"> | null | undefined,
  entity: { type: string; id: string } | null | undefined,
  state: "viewing" | "editing" = "viewing",
): PresenceUser[] | undefined {
  const heartbeat = useCoreMutation(coreApi.presence.heartbeat)
  const leave = useCoreMutation(coreApi.presence.leave)
  const entityType = entity?.type
  const entityId = entity?.id

  React.useEffect(() => {
    if (!workspaceId || !entityType || !entityId) return
    const args = { workspaceId, entityType, entityId, state }
    void heartbeat(args).catch(() => {})
    const timer = setInterval(() => {
      void heartbeat(args).catch(() => {})
    }, HEARTBEAT_MS)
    return () => {
      clearInterval(timer)
      void leave({ workspaceId, entityType, entityId }).catch(() => {})
    }
  }, [workspaceId, entityType, entityId, state, heartbeat, leave])

  return useCoreQuery(
    coreApi.presence.list,
    workspaceId && entityType && entityId ? { workspaceId, entityType, entityId } : "skip",
  )
}

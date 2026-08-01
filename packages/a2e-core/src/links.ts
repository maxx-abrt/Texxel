"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { EntityRef, Id, LinkDoc } from "./types"

export function useLinks(
  workspaceId: Id<"workspaces"> | null | undefined,
  target: EntityRef | null | undefined,
  direction: "from" | "to" | "both" = "both",
): LinkDoc[] | undefined {
  return useCoreQuery(
    coreApi.links.listFor,
    workspaceId && target ? { workspaceId, app: target.app, type: target.type, id: target.id, direction } : "skip",
  )
}

export function useLinkMutations() {
  const link = useCoreMutation(coreApi.links.link)
  const unlink = useCoreMutation(coreApi.links.unlink)
  return React.useMemo(() => ({ link, unlink }), [link, unlink])
}

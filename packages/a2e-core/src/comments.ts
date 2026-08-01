"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { CommentDoc, EntityRef, Id } from "./types"

export function useComments(
  workspaceId: Id<"workspaces"> | null | undefined,
  target: EntityRef | null | undefined,
): CommentDoc[] | undefined {
  return useCoreQuery(
    coreApi.comments.list,
    workspaceId && target ? { workspaceId, app: target.app, type: target.type, id: target.id } : "skip",
  )
}

export function useCommentMutations() {
  const add = useCoreMutation(coreApi.comments.add)
  const resolve = useCoreMutation(coreApi.comments.resolve)
  const unresolve = useCoreMutation(coreApi.comments.unresolve)
  const remove = useCoreMutation(coreApi.comments.remove)
  return React.useMemo(() => ({ add, resolve, unresolve, remove }), [add, resolve, unresolve, remove])
}

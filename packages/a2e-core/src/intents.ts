"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { Id, IntentDoc } from "./types"

/** Real-time outbox: intents targeted at `appKey` (or broadcast) awaiting handling. */
export function usePendingIntents(
  workspaceId: Id<"workspaces"> | null | undefined,
  appKey: string,
): IntentDoc[] | undefined {
  return useCoreQuery(coreApi.intents.listPending, workspaceId ? { workspaceId, appKey } : "skip")
}

export function useIntentMutations() {
  const post = useCoreMutation(coreApi.intents.post)
  const markHandled = useCoreMutation(coreApi.intents.markHandled)
  const dismiss = useCoreMutation(coreApi.intents.dismiss)
  return React.useMemo(() => ({ post, markHandled, dismiss }), [post, markHandled, dismiss])
}

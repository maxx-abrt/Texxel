"use client"

import * as React from "react"
import { useCoreAuthState, useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { NotificationDoc } from "./types"

export function useNotifications(opts?: { limit?: number; unreadOnly?: boolean }): NotificationDoc[] | undefined {
  const { isAuthenticated } = useCoreAuthState()
  return useCoreQuery(
    coreApi.notifications.listMine,
    isAuthenticated ? { limit: opts?.limit, unreadOnly: opts?.unreadOnly } : "skip",
  )
}

export function useUnreadCount(): number | undefined {
  const { isAuthenticated } = useCoreAuthState()
  return useCoreQuery(coreApi.notifications.unreadCount, isAuthenticated ? {} : "skip")
}

export function useNotificationMutations() {
  const markRead = useCoreMutation(coreApi.notifications.markRead)
  const markAllRead = useCoreMutation(coreApi.notifications.markAllRead)
  const remove = useCoreMutation(coreApi.notifications.remove)
  const clearAll = useCoreMutation(coreApi.notifications.clearAll)
  const sendToWorkspace = useCoreMutation(coreApi.notifications.sendToWorkspace)
  return React.useMemo(
    () => ({ markRead, markAllRead, remove, clearAll, sendToWorkspace }),
    [markRead, markAllRead, remove, clearAll, sendToWorkspace],
  )
}

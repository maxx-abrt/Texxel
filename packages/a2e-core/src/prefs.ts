"use client"

import { useCoreAuthState, useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { UserPrefsDoc } from "./types"

export function useUserPrefs(): UserPrefsDoc | null | undefined {
  const { isAuthenticated } = useCoreAuthState()
  return useCoreQuery(coreApi.userPrefs.get, isAuthenticated ? {} : "skip")
}

export function useUpdatePrefs() {
  return useCoreMutation(coreApi.userPrefs.update)
}

export function usePushTokenMutations() {
  return {
    register: useCoreMutation(coreApi.pushTokens.register),
    unregister: useCoreMutation(coreApi.pushTokens.unregister),
  }
}

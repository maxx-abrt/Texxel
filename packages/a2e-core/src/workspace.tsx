"use client"

import * as React from "react"
import { useCoreAuthState, useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { Id, WorkspaceMembership } from "./types"

const DEFAULT_STORAGE_KEY = "a2e_active_workspace"

interface WorkspaceContextValue {
  workspaces: WorkspaceMembership[] | undefined
  activeWorkspaceId: Id<"workspaces"> | null
  activeWorkspace: WorkspaceMembership | null
  setActiveWorkspaceId: (id: Id<"workspaces"> | null) => void
  isLoading: boolean
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

function readStored(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    /* private mode / RN without localStorage — selection stays in memory */
  }
}

export function WorkspaceProvider({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
}: {
  children: React.ReactNode
  storageKey?: string
}) {
  const { isAuthenticated } = useCoreAuthState()
  const store = useCoreMutation(coreApi.users.store)
  const storedOnce = React.useRef(false)

  // Guarantee provisioning (user row + personal workspace) exactly once per session.
  React.useEffect(() => {
    if (!isAuthenticated || storedOnce.current) return
    storedOnce.current = true
    void store({}).catch(() => {
      storedOnce.current = false
    })
  }, [isAuthenticated, store])

  const workspaces = useCoreQuery(coreApi.workspaces.listMine, isAuthenticated ? {} : "skip")
  const [selectedId, setSelectedId] = React.useState<Id<"workspaces"> | null>(() => readStored(storageKey))

  // Validate the hydrated selection against real memberships; fall back to the first.
  React.useEffect(() => {
    if (!workspaces) return
    if (workspaces.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    const valid = selectedId && workspaces.some((w) => w._id === selectedId)
    if (!valid) setSelectedId(workspaces[0]._id)
  }, [workspaces, selectedId])

  const setActiveWorkspaceId = React.useCallback(
    (id: Id<"workspaces"> | null) => {
      setSelectedId(id)
      writeStored(storageKey, id)
    },
    [storageKey],
  )

  React.useEffect(() => {
    if (selectedId) writeStored(storageKey, selectedId)
  }, [selectedId, storageKey])

  const activeWorkspace = React.useMemo(
    () => workspaces?.find((w) => w._id === selectedId) ?? null,
    [workspaces, selectedId],
  )

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspaceId: activeWorkspace?._id ?? null,
      activeWorkspace,
      setActiveWorkspaceId,
      isLoading: isAuthenticated && workspaces === undefined,
    }),
    [workspaces, activeWorkspace, setActiveWorkspaceId, isAuthenticated],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext)
  if (!ctx) throw new Error("[@a2e/core] Missing <WorkspaceProvider>.")
  return ctx
}

/** Convenience: the active workspace id, or null while loading/unauthenticated. */
export function useActiveWorkspaceId(): Id<"workspaces"> | null {
  return useWorkspace().activeWorkspaceId
}

"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { Id, LabelDoc, TaskDoc, TaskStatusDoc } from "./types"

export function useTasks(workspaceId?: Id<"workspaces"> | null, parentId?: Id<"tasks">): TaskDoc[] | undefined {
  return useCoreQuery(coreApi.tasks.list, workspaceId ? { workspaceId, parentId } : "skip")
}

export function useMyTasks(workspaceId?: Id<"workspaces"> | null): TaskDoc[] | undefined {
  return useCoreQuery(coreApi.tasks.listMine, workspaceId ? { workspaceId } : "skip")
}

/** Task statuses, seeding the todo/in_progress/done defaults on the first empty read. */
export function useTaskStatuses(workspaceId?: Id<"workspaces"> | null): TaskStatusDoc[] | undefined {
  const statuses = useCoreQuery(coreApi.tasks.listStatuses, workspaceId ? { workspaceId } : "skip")
  const ensureDefaults = useCoreMutation(coreApi.tasks.ensureDefaultStatuses)
  const seeded = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!workspaceId || statuses === undefined) return
    if (statuses.length > 0 || seeded.current === workspaceId) return
    seeded.current = workspaceId
    void ensureDefaults({ workspaceId }).catch(() => {
      seeded.current = null
    })
  }, [workspaceId, statuses, ensureDefaults])

  return statuses
}

export function useLabels(workspaceId?: Id<"workspaces"> | null): LabelDoc[] | undefined {
  return useCoreQuery(coreApi.tasks.listLabels, workspaceId ? { workspaceId } : "skip")
}

export function useTaskMutations() {
  const create = useCoreMutation(coreApi.tasks.create)
  const update = useCoreMutation(coreApi.tasks.update)
  const setStatus = useCoreMutation(coreApi.tasks.setStatus)
  const remove = useCoreMutation(coreApi.tasks.remove)
  const restore = useCoreMutation(coreApi.tasks.restore)
  const createStatus = useCoreMutation(coreApi.tasks.createStatus)
  const updateStatus = useCoreMutation(coreApi.tasks.updateStatus)
  const removeStatus = useCoreMutation(coreApi.tasks.removeStatus)
  const reorderStatuses = useCoreMutation(coreApi.tasks.reorderStatuses)
  const createLabel = useCoreMutation(coreApi.tasks.createLabel)
  const removeLabel = useCoreMutation(coreApi.tasks.removeLabel)
  return React.useMemo(
    () => ({
      create,
      update,
      setStatus,
      remove,
      restore,
      createStatus,
      updateStatus,
      removeStatus,
      reorderStatuses,
      createLabel,
      removeLabel,
    }),
    [
      create,
      update,
      setStatus,
      remove,
      restore,
      createStatus,
      updateStatus,
      removeStatus,
      reorderStatuses,
      createLabel,
      removeLabel,
    ],
  )
}

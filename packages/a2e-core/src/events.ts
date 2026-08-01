"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { EventAttendeeDoc, EventDoc, Id } from "./types"

export function useEvents(
  workspaceId?: Id<"workspaces"> | null,
  range?: { start: number; end: number },
): EventDoc[] | undefined {
  return useCoreQuery(coreApi.events.list, workspaceId ? { workspaceId, start: range?.start, end: range?.end } : "skip")
}

export function useEventAttendees(eventId?: Id<"events"> | null): EventAttendeeDoc[] | undefined {
  return useCoreQuery(coreApi.events.listAttendees, eventId ? { eventId } : "skip")
}

export function useEventMutations() {
  const create = useCoreMutation(coreApi.events.create)
  const update = useCoreMutation(coreApi.events.update)
  const remove = useCoreMutation(coreApi.events.remove)
  const rsvp = useCoreMutation(coreApi.events.rsvp)
  return React.useMemo(() => ({ create, update, remove, rsvp }), [create, update, remove, rsvp])
}

export { expandEvents } from "./recurrence"

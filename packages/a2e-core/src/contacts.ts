"use client"

import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { ContactDoc, EntityRef, Id } from "./types"

export function useContacts(workspaceId?: Id<"workspaces"> | null): ContactDoc[] | undefined {
  return useCoreQuery(coreApi.contacts.list, workspaceId ? { workspaceId } : "skip")
}

export function useContact(contactId?: Id<"contacts"> | null): ContactDoc | null | undefined {
  return useCoreQuery(coreApi.contacts.get, contactId ? { contactId } : "skip")
}

export function useContactSearch(workspaceId: Id<"workspaces"> | null | undefined, query: string) {
  const term = query.trim()
  return useCoreQuery(coreApi.contacts.search, workspaceId && term.length >= 2 ? { workspaceId, query: term } : "skip")
}

export function useContactsFor(
  workspaceId: Id<"workspaces"> | null | undefined,
  target: EntityRef | null | undefined,
): ContactDoc[] | undefined {
  return useCoreQuery(
    coreApi.contacts.listForTarget,
    workspaceId && target ? { workspaceId, app: target.app, type: target.type, id: target.id } : "skip",
  )
}

export function useContactMutations() {
  const create = useCoreMutation(coreApi.contacts.create)
  const update = useCoreMutation(coreApi.contacts.update)
  const remove = useCoreMutation(coreApi.contacts.remove)
  const link = useCoreMutation(coreApi.contacts.link)
  const unlink = useCoreMutation(coreApi.contacts.unlink)
  return React.useMemo(() => ({ create, update, remove, link, unlink }), [create, update, remove, link, unlink])
}

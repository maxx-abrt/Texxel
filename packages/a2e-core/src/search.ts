"use client"

import * as React from "react"
import { useCoreQuery, useCoreRoutes } from "./client"
import { coreApi } from "./refs"
import type { CoreRoutes, Id, SearchHit, SearchResults } from "./types"

const EMPTY: SearchResults = { files: [], contacts: [], events: [], tasks: [], members: [] }

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function withHref(hits: SearchHit[], route?: (id: string) => string): SearchHit[] {
  if (!route) return hits
  return hits.map((hit) => ({ ...hit, href: hit.href ?? route(hit.id) }))
}

function applyRoutes(results: SearchResults, routes: CoreRoutes): SearchResults {
  return {
    files: withHref(results.files, routes.drive),
    contacts: withHref(results.contacts, routes.contact),
    events: withHref(results.events, routes.event),
    tasks: withHref(results.tasks, routes.task),
    members: withHref(results.members, routes.member),
  }
}

/** Suite-wide search across drive, contacts, events, tasks and members. Debounced 250 ms. */
export function useCoreSearch(
  workspaceId: Id<"workspaces"> | null | undefined,
  query: string,
  limit?: number,
): { results: SearchResults; isLoading: boolean } {
  const routes = useCoreRoutes()
  const debounced = useDebounced(query.trim(), 250)
  const enabled = Boolean(workspaceId) && debounced.length >= 2
  const raw = useCoreQuery(coreApi.search.search, enabled ? { workspaceId: workspaceId!, query: debounced, limit } : "skip")

  const results = React.useMemo(() => (raw ? applyRoutes(raw, routes) : EMPTY), [raw, routes])
  return { results, isLoading: enabled && raw === undefined }
}

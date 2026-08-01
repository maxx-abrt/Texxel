"use client"

import { ConvexHttpClient } from "convex/browser"
import * as React from "react"
import { useCoreMutation, useCoreQuery } from "./client"
import { CORE_URL_ENV_KEYS, readEnv } from "./env"
import { withCoreErrors } from "./errors"
import { coreApi } from "./refs"
import type { EntityRef, Id, ShareDoc } from "./types"

export function useSharesFor(
  workspaceId: Id<"workspaces"> | null | undefined,
  target: EntityRef | null | undefined,
): ShareDoc[] | undefined {
  return useCoreQuery(
    coreApi.shares.listFor,
    workspaceId && target ? { workspaceId, app: target.app, type: target.type, id: target.id } : "skip",
  )
}

export function useShareMutations() {
  const create = useCoreMutation(coreApi.shares.create)
  const revoke = useCoreMutation(coreApi.shares.revoke)
  return React.useMemo(() => ({ create, revoke }), [create, revoke])
}

/** Public pages have no authenticated provider — talk to core over HTTP instead. */
function publicClient(url?: string): ConvexHttpClient {
  const resolved = url ?? readEnv(...CORE_URL_ENV_KEYS)
  if (!resolved) throw new Error("[@a2e/core] Missing core URL for public share access.")
  return new ConvexHttpClient(resolved)
}

/** Resolve a share token without auth. Returns metadata only (never the s3Key). */
export function resolveShare(token: string, passphrase?: string, url?: string) {
  return withCoreErrors(() => publicClient(url).query(coreApi.shares.resolve, { token, passphrase }))
}

/** Short-lived presigned GET for the drive file behind a share token. */
export async function getSharedFileUrl(token: string, passphrase?: string, url?: string): Promise<string> {
  const { url: signed } = await withCoreErrors(() =>
    publicClient(url).action(coreApi.shares.publicDownload, { token, passphrase }),
  )
  return signed
}

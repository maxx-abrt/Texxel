"use client"

import { useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { EntitlementInfo, Id, PlanLimits, UsageCounters } from "./types"

export type QuotaDomain = keyof PlanLimits

/**
 * Counter backing each domain. `null` = no usage counter exists (members, custom
 * roles and per-file size are enforced server-side against live row counts/args),
 * so `useQuota` reports `used: 0` for them — the server remains the source of truth.
 */
const USAGE_BY_DOMAIN: Record<QuotaDomain, keyof UsageCounters | null> = {
  storageBytes: "storageUsed",
  maxMembers: null,
  maxTasks: "taskCount",
  maxDriveFiles: "driveFileCount",
  maxEvents: "eventCount",
  maxContacts: "contactCount",
  maxFileUploadBytes: null,
  maxCustomRoles: null,
  maxFormsResponsesPerMonth: "formsResponsesThisMonth",
}

export function useEntitlement(workspaceId?: Id<"workspaces"> | null): EntitlementInfo | undefined {
  return useCoreQuery(coreApi.entitlements.get, workspaceId ? { workspaceId } : "skip")
}

export interface QuotaState {
  allowed: boolean
  used: number
  limit: number
  percent: number
  upgradeRequired: boolean
  isLoading: boolean
}

/**
 * UI-facing quota state. `-1` limits mean unlimited (enterprise).
 * Note: `maxMembers` / `maxCustomRoles` are enforced server-side against live row
 * counts, so their `used` value here is indicative only.
 */
export function useQuota(workspaceId: Id<"workspaces"> | null | undefined, domain: QuotaDomain): QuotaState {
  const entitlement = useEntitlement(workspaceId)
  if (!entitlement) {
    return { allowed: true, used: 0, limit: 0, percent: 0, upgradeRequired: false, isLoading: true }
  }
  const limit = entitlement.limits[domain]
  const counter = USAGE_BY_DOMAIN[domain]
  const used = counter ? (entitlement.usage[counter] ?? 0) : 0
  const unlimited = limit === -1
  return {
    allowed: unlimited || used < limit,
    used,
    limit,
    percent: unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100)),
    upgradeRequired: !unlimited && used >= limit,
    isLoading: false,
  }
}

/** True when the workspace plan grants access to a suite app ("drive", "forms", …). */
export function useAppAccess(workspaceId: Id<"workspaces"> | null | undefined, appKey: string): boolean | undefined {
  const entitlement = useEntitlement(workspaceId)
  return entitlement ? entitlement.appAccess.includes(appKey) : undefined
}

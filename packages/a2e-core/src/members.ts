"use client"

import * as React from "react"
import { useCoreAuthState, useCoreMutation, useCoreQuery } from "./client"
import { coreApi } from "./refs"
import type { Id, InvitationDoc, MemberDoc, RoleDoc, UserDoc } from "./types"

export function useMe(): UserDoc | null | undefined {
  const { isAuthenticated } = useCoreAuthState()
  return useCoreQuery(coreApi.users.me, isAuthenticated ? {} : "skip")
}

export function useMembers(workspaceId?: Id<"workspaces"> | null): MemberDoc[] | undefined {
  return useCoreQuery(coreApi.workspaces.listMembers, workspaceId ? { workspaceId } : "skip")
}

export function useInvitations(workspaceId?: Id<"workspaces"> | null): InvitationDoc[] | undefined {
  return useCoreQuery(coreApi.invitations.listByWorkspace, workspaceId ? { workspaceId } : "skip")
}

export function useInvitationByToken(token?: string | null) {
  return useCoreQuery(coreApi.invitations.getByToken, token ? { token } : "skip")
}

export function useRoles(workspaceId?: Id<"workspaces"> | null): RoleDoc[] | undefined {
  return useCoreQuery(coreApi.roles.list, workspaceId ? { workspaceId } : "skip")
}

/** Caller's effective permissions in the workspace — use for UI gating only. */
export function useMyPermissions(workspaceId?: Id<"workspaces"> | null): string[] | undefined {
  return useCoreQuery(coreApi.roles.myPermissions, workspaceId ? { workspaceId } : "skip")
}

export function useHasPermission(workspaceId: Id<"workspaces"> | null | undefined, permission: string) {
  const permissions = useMyPermissions(workspaceId)
  return permissions ? permissions.includes(permission) : undefined
}

export function useWorkspaceMutations() {
  const create = useCoreMutation(coreApi.workspaces.create)
  const update = useCoreMutation(coreApi.workspaces.update)
  const updateMemberRole = useCoreMutation(coreApi.workspaces.updateMemberRole)
  const removeMember = useCoreMutation(coreApi.workspaces.removeMember)
  const updateProfile = useCoreMutation(coreApi.users.updateProfile)
  return React.useMemo(
    () => ({ create, update, updateMemberRole, removeMember, updateProfile }),
    [create, update, updateMemberRole, removeMember, updateProfile],
  )
}

export function useInvitationMutations() {
  const invite = useCoreMutation(coreApi.invitations.invite)
  const revoke = useCoreMutation(coreApi.invitations.revoke)
  const accept = useCoreMutation(coreApi.invitations.accept)
  return React.useMemo(() => ({ invite, revoke, accept }), [invite, revoke, accept])
}

export function useRoleMutations() {
  const create = useCoreMutation(coreApi.roles.create)
  const update = useCoreMutation(coreApi.roles.update)
  const remove = useCoreMutation(coreApi.roles.remove)
  const assign = useCoreMutation(coreApi.roles.assign)
  const unassign = useCoreMutation(coreApi.roles.unassign)
  return React.useMemo(() => ({ create, update, remove, assign, unassign }), [create, update, remove, assign, unassign])
}

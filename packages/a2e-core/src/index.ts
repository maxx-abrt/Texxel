/**
 * `@a2e/core` — the only integration surface for the A2E suite core deployment.
 * Apps mount <CoreProvider> (a second Convex client) and consume typed hooks.
 */
export {
  CoreAuthProvider,
  CoreProvider,
  useCoreAction,
  useCoreAuthState,
  useCoreClient,
  useCoreMutation,
  useCoreQuery,
  useCoreRoutes,
} from "./client"
export type { CoreProviderProps, CoreTokenFetcher } from "./client"

export { ForbiddenError, NotFoundError, QuotaExceededError, UnauthenticatedError, toCoreError } from "./errors"
export { coreApi } from "./refs"
export type { RecurrenceArgs } from "./refs"

export { useActiveWorkspaceId, useWorkspace, WorkspaceProvider } from "./workspace"
export {
  useHasPermission,
  useInvitationByToken,
  useInvitationMutations,
  useInvitations,
  useMe,
  useMembers,
  useMyPermissions,
  useRoleMutations,
  useRoles,
  useWorkspaceMutations,
} from "./members"

export {
  useAvatarUpload,
  useDriveMutations,
  useFiles,
  useFileSearch,
  useFileUrl,
  useFolders,
  useLinkedFiles,
  useTrash,
  useUpload,
} from "./drive"
export type { UploadArgs } from "./drive"

export { useAppAccess, useEntitlement, useQuota } from "./entitlements"
export type { QuotaDomain, QuotaState } from "./entitlements"

export { useEventAttendees, useEventMutations, useEvents } from "./events"
export { expandEvents } from "./recurrence"
export { useLabels, useMyTasks, useTaskMutations, useTasks, useTaskStatuses } from "./tasks"
export { useContact, useContactMutations, useContacts, useContactSearch, useContactsFor } from "./contacts"
export { useNotificationMutations, useNotifications, useUnreadCount } from "./notifications"
export { useActivities, useWorkspaceExport } from "./activities"
export { useCommentMutations, useComments } from "./comments"
export { useLinkMutations, useLinks } from "./links"
export { useIntentMutations, usePendingIntents } from "./intents"
export { getSharedFileUrl, resolveShare, useShareMutations, useSharesFor } from "./shares"
export { useCoreSearch } from "./search"
export { usePresence } from "./presence"
export { usePushTokenMutations, useUpdatePrefs, useUserPrefs } from "./prefs"

export { APP_KEYS } from "./types"
export type {
  ActivityDoc,
  AppKey,
  AttendeeStatus,
  CommentDoc,
  ContactDoc,
  CoreRoutes,
  DriveFileDoc,
  DriveFolderDoc,
  EntitlementInfo,
  EntityRef,
  EventAttendeeDoc,
  EventDoc,
  EventOccurrence,
  Id,
  IntentDoc,
  InvitationDoc,
  LabelDoc,
  LinkDoc,
  MemberDoc,
  MonthlyPosition,
  NotificationDoc,
  PlanLimits,
  PresenceUser,
  RecurrenceFreq,
  Role,
  RoleDoc,
  SearchHit,
  SearchResults,
  ShareDoc,
  TaskDoc,
  TaskPriority,
  TaskStatusDoc,
  UsageCounters,
  UserDoc,
  UserPrefsDoc,
  UserSummary,
  WorkspaceDoc,
  WorkspaceMembership,
  WorkspaceType,
} from "./types"

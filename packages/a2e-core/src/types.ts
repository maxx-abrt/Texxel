/**
 * Shapes mirroring the core Convex schema. Additive-only: never remove or rename
 * a field here — apps pin `@a2e/core` versions and upgrade explicitly.
 */

export type Id<T extends string = string> = string & { __table?: T }

export const APP_KEYS = ["bilan", "bureau", "drive", "forms", "crm", "core"] as const
export type AppKey = (typeof APP_KEYS)[number]

export type Role = "owner" | "admin" | "member" | "viewer"
export type WorkspaceType = "individual" | "business" | "association"

export interface EntityRef {
  app: string
  type: string
  id: string
}

export interface UserSummary {
  _id: string
  name?: string
  email: string
  image?: string
}

export interface UserDoc {
  _id: Id<"users">
  email: string
  name?: string
  image?: string
  createdAt: number
}

export interface WorkspaceDoc {
  _id: Id<"workspaces">
  name: string
  slug: string
  description?: string
  avatar?: string
  storageQuota: number
  ownerId: Id<"users">
  locale?: string
  currency?: string
  type?: WorkspaceType
  createdAt: number
  updatedAt: number
}

export interface WorkspaceMembership extends WorkspaceDoc {
  role: Role
  memberCount: number
}

export interface MemberDoc {
  _id: Id<"memberships">
  userId: Id<"users">
  workspaceId: Id<"workspaces">
  role: Role
  joinedAt: number
  user: UserSummary | null
}

export interface InvitationDoc {
  _id: Id<"invitations">
  email: string
  workspaceId: Id<"workspaces">
  role: Exclude<Role, "owner"> | Role
  token: string
  status: "pending" | "accepted" | "revoked" | "expired"
  invitedBy: Id<"users">
  expiresAt: number
  createdAt: number
}

export interface RoleDoc {
  _id: Id<"roles">
  workspaceId: Id<"workspaces">
  name: string
  color: string
  permissions: string[]
  isDefault?: boolean
  order: number
  createdAt: number
  updatedAt: number
}

export interface DriveFolderDoc {
  _id: Id<"drive_folders">
  workspaceId: Id<"workspaces">
  parentId?: Id<"drive_folders">
  name: string
  color?: string
  sourceApp: string
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
}

export interface DriveFileDoc {
  _id: Id<"drive_files">
  workspaceId: Id<"workspaces">
  folderId?: Id<"drive_folders">
  name: string
  size: number
  contentType?: string
  sourceApp: string
  linkedTo?: EntityRef
  deletedAt?: number
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
}

export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly"
export type MonthlyPosition = "same_day" | "first" | "second" | "third" | "fourth" | "last"

export interface EventDoc {
  _id: Id<"events">
  workspaceId: Id<"workspaces">
  title: string
  description?: string
  start: number
  end?: number
  allDay?: boolean
  recurrenceFreq?: RecurrenceFreq
  recurrenceInterval?: number
  recurrenceDaysOfWeek?: number[]
  recurrenceMonthlyPosition?: MonthlyPosition
  recurrenceEndAfter?: number
  recurrenceUntil?: number
  recurrenceExceptions?: number[]
  color?: string
  location?: string
  sourceApp: string
  linkedTo?: EntityRef
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
}

/** An occurrence produced by `expandEvents` — carries the source event id. */
export interface EventOccurrence extends EventDoc {
  occurrenceStart: number
  occurrenceEnd?: number
  isRecurringInstance: boolean
}

export type AttendeeStatus = "invited" | "accepted" | "declined" | "tentative"

export interface EventAttendeeDoc {
  _id: Id<"eventAttendees">
  eventId: Id<"events">
  workspaceId: Id<"workspaces">
  userId?: Id<"users">
  email?: string
  name?: string
  status: AttendeeStatus
  createdAt: number
  updatedAt: number
}

export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent"

export interface TaskDoc {
  _id: Id<"tasks">
  workspaceId: Id<"workspaces">
  parentId?: Id<"tasks">
  title: string
  description?: string
  status: string
  assigneeId?: Id<"users">
  assignee?: UserSummary | null
  dueDate?: number
  priority?: TaskPriority
  labels?: string[]
  order?: number
  startDate?: number
  estimateMinutes?: number
  sourceApp: string
  linkedTo?: EntityRef
  deletedAt?: number
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
}

export interface TaskStatusDoc {
  _id: Id<"taskStatuses">
  workspaceId: Id<"workspaces">
  key: string
  label: string
  color: string
  order: number
  isDone?: boolean
  createdAt: number
  updatedAt: number
}

export interface LabelDoc {
  _id: Id<"labels">
  workspaceId: Id<"workspaces">
  name: string
  color: string
  createdAt: number
}

export interface ContactDoc {
  _id: Id<"contacts">
  workspaceId: Id<"workspaces">
  name: string
  email?: string
  phone?: string
  company?: string
  address?: string
  siret?: string
  notes?: string
  tags?: string[]
  sourceApp: string
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
}

export interface NotificationDoc {
  _id: Id<"notifications">
  userId: string
  workspaceId?: Id<"workspaces">
  type: string
  title: string
  message?: string
  read: boolean
  link?: string
  metadata?: unknown
  sourceApp?: string
  createdAt: number
}

export interface ActivityDoc {
  _id: Id<"activities">
  workspaceId: Id<"workspaces">
  actorId: Id<"users">
  actor?: UserSummary | null
  action: string
  targetType: string
  targetId: string
  metadata?: unknown
  sourceApp?: string
  createdAt: number
}

export interface CommentDoc {
  _id: Id<"comments">
  workspaceId: Id<"workspaces">
  target: EntityRef
  userId: Id<"users">
  author?: UserSummary | null
  content: string
  mentionedUserIds?: Id<"users">[]
  parentId?: Id<"comments">
  resolved?: boolean
  resolvedBy?: Id<"users">
  createdAt: number
  updatedAt: number
}

export interface LinkDoc {
  _id: Id<"links">
  workspaceId: Id<"workspaces">
  fromApp: string
  fromType: string
  fromId: string
  toApp: string
  toType: string
  toId: string
  label?: string
  createdBy: Id<"users">
  createdAt: number
}

export interface IntentDoc {
  _id: Id<"intents">
  workspaceId: Id<"workspaces">
  type: string
  fromApp: string
  toApps: string[]
  payload: unknown
  status: "pending" | "handled" | "dismissed"
  handledBy?: string
  createdBy?: Id<"users">
  createdAt: number
  handledAt?: number
}

export interface ShareDoc {
  _id: Id<"shares">
  workspaceId: Id<"workspaces">
  target: EntityRef
  token: string
  permission: "read" | "write"
  expiresAt?: number
  revokedAt?: number
  createdBy: Id<"users">
  createdAt: number
}

export interface PresenceUser {
  userId: Id<"users">
  state: string
  lastSeen: number
  user: UserSummary | null
}

export interface UserPrefsDoc {
  _id: Id<"userPrefs">
  userId: Id<"users">
  locale?: string
  theme?: string
  accentColor?: string
  lastWorkspaceId?: Id<"workspaces">
  notificationsEmail?: "off" | "daily" | "weekly"
  notificationsPush?: boolean
  onboardingCompleted?: boolean
  createdAt: number
  updatedAt: number
}

export interface PlanLimits {
  storageBytes: number
  maxMembers: number
  maxTasks: number
  maxDriveFiles: number
  maxEvents: number
  maxContacts: number
  maxFileUploadBytes: number
  maxCustomRoles: number
  maxFormsResponsesPerMonth: number
}

export interface UsageCounters {
  storageUsed: number
  taskCount: number
  driveFileCount: number
  eventCount: number
  contactCount: number
  formsResponsesThisMonth: number
}

export interface EntitlementInfo {
  planKey: string
  limits: PlanLimits
  usage: UsageCounters
  appAccess: string[]
}

export interface SearchHit {
  id: string
  title: string
  subtitle?: string
  href?: string
  kind: string
}

export interface SearchResults {
  files: SearchHit[]
  contacts: SearchHit[]
  events: SearchHit[]
  tasks: SearchHit[]
  members: SearchHit[]
}

/** Maps core entities to app-local URLs (provided via `<CoreProvider routes>`). */
export interface CoreRoutes {
  drive?: (fileId: string) => string
  contact?: (contactId: string) => string
  event?: (eventId: string) => string
  task?: (taskId: string) => string
  member?: (userId: string) => string
}

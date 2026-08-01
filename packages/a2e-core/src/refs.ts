/**
 * Typed function references, declared by name (never importing `convex/_generated/api`)
 * so the package works identically under webpack/turbopack and Metro (Expo).
 *
 * Names map 1:1 to `convex/<file>.ts` exports in the A2ECore repo — keep in sync.
 */
import { makeFunctionReference } from "convex/server"
import type {
  ActivityDoc,
  AttendeeStatus,
  CommentDoc,
  ContactDoc,
  DriveFileDoc,
  DriveFolderDoc,
  EntitlementInfo,
  EntityRef,
  EventAttendeeDoc,
  EventDoc,
  Id,
  IntentDoc,
  InvitationDoc,
  LabelDoc,
  LinkDoc,
  MemberDoc,
  NotificationDoc,
  PresenceUser,
  RecurrenceFreq,
  Role,
  RoleDoc,
  SearchResults,
  ShareDoc,
  TaskDoc,
  TaskPriority,
  TaskStatusDoc,
  UserDoc,
  UserPrefsDoc,
  WorkspaceMembership,
  WorkspaceType,
} from "./types"

// Convex's arg constraint needs an index signature; intersections (e.g. `X & RecurrenceArgs`)
// only satisfy it via `any`. Public hook signatures stay fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>
const q = <A extends Args = Args, R = unknown>(name: string) => makeFunctionReference<"query", A, R>(name)
const m = <A extends Args = Args, R = unknown>(name: string) => makeFunctionReference<"mutation", A, R>(name)
const a = <A extends Args = Args, R = unknown>(name: string) => makeFunctionReference<"action", A, R>(name)

type WsId = Id<"workspaces">
type Empty = Record<string, never>

export interface RecurrenceArgs {
  recurrenceFreq?: RecurrenceFreq
  recurrenceInterval?: number
  recurrenceDaysOfWeek?: number[]
  recurrenceMonthlyPosition?: EventDoc["recurrenceMonthlyPosition"]
  recurrenceEndAfter?: number
  recurrenceUntil?: number
  recurrenceExceptions?: number[]
}

export const coreApi = {
  users: {
    store: m<Empty, Id<"users">>("users:store"),
    me: q<Empty, UserDoc | null>("users:me"),
    updateProfile: m<{ name?: string; image?: string }, null>("users:updateProfile"),
  },
  workspaces: {
    listMine: q<Empty, WorkspaceMembership[]>("workspaces:listMine"),
    create: m<
      {
        name: string
        description?: string
        avatar?: string
        type?: WorkspaceType
        locale?: string
        currency?: string
      },
      WsId
    >("workspaces:create"),
    update: m<
      {
        workspaceId: WsId
        name?: string
        description?: string
        avatar?: string
        locale?: string
        currency?: string
        type?: WorkspaceType
      },
      null
    >("workspaces:update"),
    listMembers: q<{ workspaceId: WsId }, MemberDoc[]>("workspaces:listMembers"),
    updateMemberRole: m<{ workspaceId: WsId; userId: Id<"users">; role: Role }, null>(
      "workspaces:updateMemberRole",
    ),
    removeMember: m<{ workspaceId: WsId; userId: Id<"users"> }, null>("workspaces:removeMember"),
  },
  invitations: {
    listByWorkspace: q<{ workspaceId: WsId }, InvitationDoc[]>("invitations:listByWorkspace"),
    invite: m<{ workspaceId: WsId; email: string; role: "admin" | "member" | "viewer" }, { id: Id<"invitations">; token: string }>(
      "invitations:invite",
    ),
    revoke: m<{ invitationId: Id<"invitations"> }, null>("invitations:revoke"),
    getByToken: q<
      { token: string },
      (InvitationDoc & { workspace: { name: string; slug: string; avatar?: string } | null }) | null
    >("invitations:getByToken"),
    accept: m<{ token: string }, WsId>("invitations:accept"),
  },
  roles: {
    list: q<{ workspaceId: WsId }, RoleDoc[]>("roles:list"),
    create: m<{ workspaceId: WsId; name: string; color: string; permissions: string[]; order: number }, Id<"roles">>(
      "roles:create",
    ),
    update: m<
      { roleId: Id<"roles">; name?: string; color?: string; permissions?: string[]; order?: number },
      null
    >("roles:update"),
    remove: m<{ roleId: Id<"roles"> }, null>("roles:remove"),
    assign: m<{ workspaceId: WsId; userId: Id<"users">; roleId: Id<"roles"> }, Id<"roleAssignments">>("roles:assign"),
    unassign: m<{ assignmentId: Id<"roleAssignments"> }, null>("roles:unassign"),
    myPermissions: q<{ workspaceId: WsId }, string[]>("roles:myPermissions"),
  },
  entitlements: {
    get: q<{ workspaceId: WsId }, EntitlementInfo>("entitlements:get"),
  },
  drive: {
    presignUpload: a<
      {
        workspaceId: WsId
        name: string
        size: number
        contentType?: string
        folderId?: Id<"drive_folders">
        sourceApp: string
        linkedTo?: EntityRef
      },
      { fileId: Id<"drive_files">; uploadUrl: string; s3Key: string }
    >("drive:presignUpload"),
    presignDownload: a<{ fileId: Id<"drive_files"> }, { url: string }>("drive:presignDownload"),
    presignView: a<{ fileId: Id<"drive_files"> }, { url: string }>("drive:presignView"),
    presignAvatar: a<
      { workspaceId: WsId; contentType: string },
      { uploadUrl: string; publicUrl: null; s3Key: string }
    >("drive:presignAvatar"),
    listFiles: q<{ workspaceId: WsId; folderId?: Id<"drive_folders"> }, DriveFileDoc[]>("drive:listFiles"),
    listTrash: q<{ workspaceId: WsId }, DriveFileDoc[]>("drive:listTrash"),
    listLinked: q<{ workspaceId: WsId; app: string; type: string; id: string }, DriveFileDoc[]>("drive:listLinked"),
    searchFiles: q<{ workspaceId: WsId; query: string }, DriveFileDoc[]>("drive:searchFiles"),
    listFolders: q<{ workspaceId: WsId; parentId?: Id<"drive_folders"> }, DriveFolderDoc[]>("drive:listFolders"),
    createFolder: m<
      { workspaceId: WsId; name: string; parentId?: Id<"drive_folders">; color?: string; sourceApp: string },
      Id<"drive_folders">
    >("drive:createFolder"),
    renameFolder: m<{ folderId: Id<"drive_folders">; name: string }, null>("drive:renameFolder"),
    deleteFolder: m<{ folderId: Id<"drive_folders"> }, null>("drive:deleteFolder"),
    renameFile: m<{ fileId: Id<"drive_files">; name: string }, null>("drive:renameFile"),
    moveFile: m<{ fileId: Id<"drive_files">; folderId?: Id<"drive_folders"> }, null>("drive:moveFile"),
    removeFile: m<{ fileId: Id<"drive_files"> }, null>("drive:removeFile"),
    restoreFile: m<{ fileId: Id<"drive_files"> }, null>("drive:restoreFile"),
    emptyTrash: m<{ workspaceId: WsId }, number>("drive:emptyTrash"),
  },
  events: {
    list: q<{ workspaceId: WsId; start?: number; end?: number }, EventDoc[]>("events:list"),
    create: m<
      {
        workspaceId: WsId
        title: string
        description?: string
        start: number
        end?: number
        allDay?: boolean
        color?: string
        location?: string
        sourceApp: string
        linkedTo?: EntityRef
        attendees?: { userId?: Id<"users">; email?: string; name?: string }[]
      } & RecurrenceArgs,
      Id<"events">
    >("events:create"),
    update: m<
      {
        eventId: Id<"events">
        title?: string
        description?: string
        start?: number
        end?: number
        allDay?: boolean
        color?: string
        location?: string
      } & RecurrenceArgs,
      null
    >("events:update"),
    remove: m<{ eventId: Id<"events"> }, null>("events:remove"),
    rsvp: m<{ eventId: Id<"events">; status: AttendeeStatus }, null>("events:rsvp"),
    listAttendees: q<{ eventId: Id<"events"> }, EventAttendeeDoc[]>("events:listAttendees"),
  },
  tasks: {
    list: q<{ workspaceId: WsId; parentId?: Id<"tasks"> }, TaskDoc[]>("tasks:list"),
    listMine: q<{ workspaceId: WsId }, TaskDoc[]>("tasks:listMine"),
    create: m<
      {
        workspaceId: WsId
        title: string
        description?: string
        status?: string
        priority?: TaskPriority
        dueDate?: number
        startDate?: number
        assigneeId?: Id<"users">
        labels?: string[]
        parentId?: Id<"tasks">
        estimateMinutes?: number
        sourceApp: string
        linkedTo?: EntityRef
      },
      Id<"tasks">
    >("tasks:create"),
    update: m<
      {
        taskId: Id<"tasks">
        title?: string
        description?: string
        status?: string
        priority?: TaskPriority
        dueDate?: number
        startDate?: number
        assigneeId?: Id<"users">
        labels?: string[]
        order?: number
        estimateMinutes?: number
      },
      null
    >("tasks:update"),
    setStatus: m<{ taskId: Id<"tasks">; status: string }, null>("tasks:setStatus"),
    remove: m<{ taskId: Id<"tasks"> }, null>("tasks:remove"),
    restore: m<{ taskId: Id<"tasks"> }, null>("tasks:restore"),
    listStatuses: q<{ workspaceId: WsId }, TaskStatusDoc[]>("tasks:listStatuses"),
    ensureDefaultStatuses: m<{ workspaceId: WsId }, null>("tasks:ensureDefaultStatuses"),
    createStatus: m<{ workspaceId: WsId; key: string; label: string; color: string; isDone?: boolean }, Id<"taskStatuses">>(
      "tasks:createStatus",
    ),
    updateStatus: m<
      { statusId: Id<"taskStatuses">; label?: string; color?: string; order?: number; isDone?: boolean },
      null
    >("tasks:updateStatus"),
    removeStatus: m<{ statusId: Id<"taskStatuses"> }, null>("tasks:removeStatus"),
    reorderStatuses: m<{ workspaceId: WsId; statusIds: Id<"taskStatuses">[] }, null>("tasks:reorderStatuses"),
    listLabels: q<{ workspaceId: WsId }, LabelDoc[]>("tasks:listLabels"),
    createLabel: m<{ workspaceId: WsId; name: string; color: string }, Id<"labels">>("tasks:createLabel"),
    removeLabel: m<{ labelId: Id<"labels"> }, null>("tasks:removeLabel"),
  },
  contacts: {
    list: q<{ workspaceId: WsId }, ContactDoc[]>("contacts:list"),
    get: q<{ contactId: Id<"contacts"> }, ContactDoc | null>("contacts:get"),
    search: q<{ workspaceId: WsId; query: string }, ContactDoc[]>("contacts:search"),
    create: m<
      {
        workspaceId: WsId
        name: string
        email?: string
        phone?: string
        company?: string
        address?: string
        siret?: string
        notes?: string
        tags?: string[]
        sourceApp: string
        link?: EntityRef
      },
      Id<"contacts">
    >("contacts:create"),
    update: m<
      {
        contactId: Id<"contacts">
        name?: string
        email?: string
        phone?: string
        company?: string
        address?: string
        siret?: string
        notes?: string
        tags?: string[]
      },
      null
    >("contacts:update"),
    remove: m<{ contactId: Id<"contacts"> }, null>("contacts:remove"),
    link: m<{ workspaceId: WsId; contactId: Id<"contacts">; app: string; type: string; id: string }, Id<"contactLinks">>(
      "contacts:link",
    ),
    unlink: m<{ linkId: Id<"contactLinks"> }, null>("contacts:unlink"),
    listForTarget: q<{ workspaceId: WsId; app: string; type: string; id: string }, ContactDoc[]>(
      "contacts:listForTarget",
    ),
  },
  notifications: {
    listMine: q<{ limit?: number; unreadOnly?: boolean }, NotificationDoc[]>("notifications:listMine"),
    unreadCount: q<Empty, number>("notifications:unreadCount"),
    markRead: m<{ notificationId: Id<"notifications"> }, null>("notifications:markRead"),
    markAllRead: m<Empty, number>("notifications:markAllRead"),
    remove: m<{ notificationId: Id<"notifications"> }, null>("notifications:remove"),
    clearAll: m<Empty, number>("notifications:clearAll"),
    sendToWorkspace: m<
      { workspaceId: WsId; type: string; title: string; message: string; link?: string; exceptSelf?: boolean },
      null
    >("notifications:sendToWorkspace"),
  },
  activities: {
    list: q<{ workspaceId: WsId; limit?: number }, ActivityDoc[]>("activities:list"),
    exportWorkspace: q<{ workspaceId: WsId }, { exportedAt: number; workspace: unknown; data: Record<string, unknown[]> }>(
      "activities:exportWorkspace",
    ),
  },
  comments: {
    list: q<{ workspaceId: WsId; app: string; type: string; id: string }, CommentDoc[]>("comments:list"),
    add: m<
      { workspaceId: WsId; target: EntityRef; content: string; mentionedUserIds?: Id<"users">[]; parentId?: Id<"comments"> },
      Id<"comments">
    >("comments:add"),
    resolve: m<{ commentId: Id<"comments"> }, null>("comments:resolve"),
    unresolve: m<{ commentId: Id<"comments"> }, null>("comments:unresolve"),
    remove: m<{ commentId: Id<"comments"> }, null>("comments:remove"),
  },
  links: {
    link: m<{ workspaceId: WsId; from: EntityRef; to: EntityRef; label?: string }, Id<"links">>("links:link"),
    unlink: m<{ linkId: Id<"links"> }, null>("links:unlink"),
    listFor: q<
      { workspaceId: WsId; app: string; type: string; id: string; direction?: "from" | "to" | "both" },
      LinkDoc[]
    >("links:listFor"),
  },
  intents: {
    post: m<{ workspaceId: WsId; type: string; fromApp: string; toApps: string[]; payload: unknown }, Id<"intents">>(
      "intents:post",
    ),
    listPending: q<{ workspaceId: WsId; appKey: string }, IntentDoc[]>("intents:listPending"),
    markHandled: m<{ intentId: Id<"intents">; appKey: string }, null>("intents:markHandled"),
    dismiss: m<{ intentId: Id<"intents"> }, null>("intents:dismiss"),
  },
  shares: {
    create: m<
      {
        workspaceId: WsId
        target: EntityRef
        permission?: "read" | "write"
        expiresAt?: number
        passphrase?: string
      },
      { shareId: Id<"shares">; token: string }
    >("shares:create"),
    revoke: m<{ shareId: Id<"shares"> }, null>("shares:revoke"),
    listFor: q<{ workspaceId: WsId; app: string; type: string; id: string }, ShareDoc[]>("shares:listFor"),
    resolve: q<
      { token: string; passphrase?: string },
      { target: EntityRef; permission: "read" | "write"; file?: { name: string; size: number; contentType?: string } } | null
    >("shares:resolve"),
    publicDownload: a<{ token: string; passphrase?: string }, { url: string }>("shares:publicDownload"),
  },
  search: {
    search: q<{ workspaceId: WsId; query: string; limit?: number }, SearchResults>("search:search"),
  },
  presence: {
    heartbeat: m<{ workspaceId: WsId; entityType: string; entityId: string; state?: string }, null>(
      "presence:heartbeat",
    ),
    leave: m<{ workspaceId: WsId; entityType: string; entityId: string }, null>("presence:leave"),
    list: q<{ workspaceId: WsId; entityType: string; entityId: string }, PresenceUser[]>("presence:list"),
  },
  userPrefs: {
    get: q<Empty, UserPrefsDoc | null>("userPrefs:get"),
    update: m<
      {
        locale?: string
        theme?: string
        accentColor?: string
        lastWorkspaceId?: WsId
        notificationsEmail?: "off" | "daily" | "weekly"
        notificationsPush?: boolean
        onboardingCompleted?: boolean
      },
      null
    >("userPrefs:update"),
  },
  pushTokens: {
    register: m<{ token: string; platform: "ios" | "android"; appKey: string }, null>("pushTokens:register"),
    unregister: m<{ token: string }, null>("pushTokens:unregister"),
  },
} as const

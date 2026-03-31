import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    ownerId: v.string(),
    isPersonal: v.boolean(),
    extensions: v.optional(v.string()),
    uiConfig: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    userEmail: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  documents: defineTable({
    title: v.string(),
    userId: v.string(),
    isArchived: v.boolean(),
    parentDocument: v.optional(v.id("documents")),
    content: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublished: v.boolean(),
    order: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
    teamId: v.optional(v.id("teams")),
    projectId: v.optional(v.id("projects")),
    collaborationMode: v.optional(v.union(v.literal("view_only"), v.literal("open"), v.literal("restricted"))),
    sharedTeamId: v.optional(v.id("teams")),
    allowedEditorEmails: v.optional(v.array(v.string())),
    shareToken: v.optional(v.string()),
    guestCanEdit: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentDocument"])
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_share_token", ["shareToken"]),

  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    iconGradientFrom: v.optional(v.string()),
    iconGradientTo: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    ownerId: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.string(),
    userEmail: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_user", ["teamId", "userId"]),

  teamInvitations: defineTable({
    teamId: v.id("teams"),
    invitedEmail: v.string(),
    invitedBy: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"), v.literal("expired")),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["invitedEmail"])
    .index("by_token", ["token"])
    .index("by_team_email", ["teamId", "invitedEmail"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("completed")),
    teamId: v.optional(v.id("teams")),
    ownerId: v.string(),
    createdAt: v.number(),
    dueDate: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"]),

  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("in_review"), v.literal("done"), v.literal("cancelled")),
    priority: v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    createdBy: v.string(),
    assigneeId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    order: v.optional(v.number()),
    parentTaskId: v.optional(v.id("tasks")),
    labels: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_creator", ["createdBy"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"])
    .index("by_project_status", ["projectId", "status"]),

  taskComments: defineTable({
    taskId: v.id("tasks"),
    userId: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_user", ["userId"]),

  userProfiles: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    role: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    gradientFrom: v.optional(v.string()),
    gradientTo: v.optional(v.string()),
    useCases: v.optional(v.array(v.string())),
    dueDateAlertsEnabled: v.optional(v.boolean()),
    dueDateAlertDays: v.optional(v.number()),
    accentPalette: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  documentThreads: defineTable({
    documentId: v.id("documents"),
    threadId: v.string(),
    resolved: v.boolean(),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.string(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_document", ["documentId"])
    .index("by_thread_id", ["threadId"]),

  documentThreadComments: defineTable({
    threadId: v.string(),
    documentId: v.id("documents"),
    commentId: v.string(),
    userId: v.string(),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    reactions: v.optional(v.string()),
  })
    .index("by_thread", ["threadId"])
    .index("by_document", ["documentId"]),

  documentVersions: defineTable({
    documentId: v.id("documents"),
    content: v.string(),
    title: v.string(),
    savedAt: v.number(),
    savedBy: v.string(),
    savedByName: v.optional(v.string()),
    label: v.optional(v.string()),
  })
    .index("by_document", ["documentId"])
    .index("by_document_time", ["documentId", "savedAt"]),

  documentPresence: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    userName: v.string(),
    userColor: v.string(),
    userImage: v.optional(v.string()),
    lastSeen: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_user", ["documentId", "userId"]),

  notifications: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("team_invitation"),
      v.literal("task_assigned"),
      v.literal("task_comment"),
      v.literal("task_completed"),
      v.literal("project_invitation"),
      v.literal("mention"),
      v.literal("task_due_soon"),
      v.literal("task_created_in_team"),
      v.literal("reminder"),
    ),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    link: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    fromUserId: v.optional(v.string()),
    fromUserName: v.optional(v.string()),
    fromUserImage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),
});

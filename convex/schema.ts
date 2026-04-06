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
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer"),
    ),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    invitedEmail: v.string(),
    invitedBy: v.string(),
    invitedByName: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["invitedEmail"])
    .index("by_token", ["token"])
    .index("by_workspace_email", ["workspaceId", "invitedEmail"]),

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

  automations: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    trigger: v.union(v.literal("task_created"), v.literal("task_status_changed"), v.literal("task_due_soon"), v.literal("task_assigned")),
    action: v.union(v.literal("set_status"), v.literal("set_priority"), v.literal("assign_to"), v.literal("send_notification"), v.literal("add_label")),
    triggerValue: v.optional(v.string()),
    actionValue: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    ownerId: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"]),

  // ─── Databases (Notion-like custom tables) ───────────────────────────────
  databases: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    ownerId: v.string(),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    // Columns definition as JSON: [{id, name, type, options?, width?}]
    // Types: text, number, select, multiSelect, date, checkbox, url, person, relation
    columns: v.string(),
    isArchived: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"]),

  databaseRows: defineTable({
    databaseId: v.id("databases"),
    // Cell values as JSON: { [columnId]: value }
    cells: v.string(),
    order: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_database", ["databaseId"])
    .index("by_database_order", ["databaseId", "order"]),

  // ─── Templates Marketplace ───────────────────────────────────────────────
  templates: defineTable({
    title: v.string(),
    description: v.string(),
    longDescription: v.optional(v.string()),
    category: v.union(
      v.literal("project_management"),
      v.literal("engineering"),
      v.literal("design"),
      v.literal("marketing"),
      v.literal("sales"),
      v.literal("hr"),
      v.literal("education"),
      v.literal("personal"),
      v.literal("startup"),
      v.literal("other"),
    ),
    coverImage: v.optional(v.string()),
    previewImages: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),

    // What's included
    includeTasks: v.boolean(),
    includeDocuments: v.boolean(),
    includeProject: v.boolean(),
    includeDatabases: v.optional(v.boolean()),

    // Template data (JSON-serialized)
    tasksData: v.optional(v.string()),
    documentsData: v.optional(v.string()),
    projectData: v.optional(v.string()),
    databasesData: v.optional(v.string()),

    // Author
    authorId: v.string(),
    authorName: v.string(),
    authorImage: v.optional(v.string()),

    // Marketplace
    isPublished: v.boolean(),
    isFeatured: v.optional(v.boolean()),
    usageCount: v.number(),
    likesCount: v.number(),
    tags: v.optional(v.array(v.string())),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_category", ["category"])
    .index("by_published", ["isPublished"])
    .index("by_featured", ["isFeatured", "isPublished"])
    .index("by_usage", ["usageCount"]),

  templateLikes: defineTable({
    templateId: v.id("templates"),
    userId: v.string(),
    createdAt: v.number(),
  })
    .index("by_template", ["templateId"])
    .index("by_user", ["userId"])
    .index("by_template_user", ["templateId", "userId"]),

  // ─── A2E Suite Subscriptions ────────────────────────────────────────────
  subscriptions: defineTable({
    userId: v.string(),
    plan: v.union(v.literal("free"), v.literal("suite")),
    // Suite = €5/mo — unlocks extended AI, infinite workspaces
    status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired")),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // ─── AI Token Usage Tracking ──────────────────────────────────────────
  aiUsage: defineTable({
    userId: v.string(),
    // Daily bucket key e.g. "2026-04-06"
    date: v.string(),
    tokensUsed: v.number(),
    requestCount: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user", ["userId"]),

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

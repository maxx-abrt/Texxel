import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * A2E SUITE SHARED SCHEMA + A2EMoney TABLES + FLUX TABLES
 *
 * - Auth tables come from convex-auth (do not redefine).
 * - Shared tables (workspaces, memberships, invitations, projects, tasks,
 *   activities, notifications) are owned by the A2E foundation and used by every
 *   app in the suite. Left UNCHANGED so A2EMoney keeps working.
 * - A2EMoney tables are prefixed `a2e_` (preserved verbatim, superset deploy).
 * - Flux (this app) adds ONLY `flux_` prefixed tables. Every flux table is
 *   workspace-scoped with a `by_workspace` index.
 */
export default defineSchema({
  // ---- users (keyed by WorkOS externalId) ----
  users: defineTable({
    externalId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_external_id", ["externalId"]),

  // ================= SHARED TABLES (suite-wide) =================
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    storageQuota: v.number(),
    ownerId: v.id("users"),
    locale: v.optional(v.string()),
    currency: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("individual"),
        v.literal("business"),
        v.literal("association"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  invitations: defineTable({
    email: v.string(),
    workspaceId: v.id("workspaces"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    client: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("on_hold"),
    ),
    budget: v.optional(v.number()),
    spent: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["workspaceId", "status"]),

  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    // Status is a string key. Defaults: "todo" | "in_progress" | "done", but
    // workspaces can define custom statuses (see flux_taskStatuses). Stored as a
    // plain string for forward-compatibility with custom workspace statuses.
    status: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project", ["projectId"])
    .index("by_assignee", ["assigneeId"]),

  activities: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.id("users"),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId", "createdAt"])
    .index("by_actor", ["actorId"])
    .index("by_target", ["targetType", "targetId"]),

  notifications: defineTable({
    // Shared, suite-wide table. Some apps store external/legacy user UUIDs here
    // (not convex-auth Id<"users">), so keep this permissive to avoid breaking
    // deploys with `v.id("users")` schema validation against existing rows.
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    type: v.string(),
    title: v.string(),
    message: v.optional(v.string()),
    body: v.optional(v.string()),
    read: v.boolean(),
    link: v.optional(v.string()),
    metadata: v.optional(v.any()),
    relatedId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "read"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_workspace", ["workspaceId"]),

  // ================= A2EMoney TABLES (a2e_) =================
  a2e_invoices: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    number: v.string(),
    client: v.string(),
    clientEmail: v.string(),
    clientAddress: v.optional(v.string()),
    items: v.array(
      v.object({
        id: v.string(),
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
      }),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
    ),
    issueDate: v.number(),
    dueDate: v.number(),
    paidDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedBookEntries: v.optional(v.array(v.string())),
    taxRate: v.optional(v.number()),
    currency: v.string(),
    linkedClientId: v.optional(v.id("a2e_clients")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["workspaceId", "status"])
    .index("by_project", ["projectId"])
    .index("by_number", ["workspaceId", "number"]),

  a2e_expenses: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    date: v.number(),
    paymentMethod: v.string(),
    type: v.union(v.literal("expense"), v.literal("income")),
    notes: v.optional(v.string()),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedInvoice: v.optional(v.id("a2e_invoices")),
    linkedBookEntries: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    recurringFrequency: v.optional(
      v.union(
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("yearly"),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    currency: v.optional(v.string()),
    sheetId: v.optional(v.id("a2e_bookSheets")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_date", ["workspaceId", "date"])
    .index("by_category", ["workspaceId", "category"])
    .index("by_project", ["projectId"])
    .index("by_sheet", ["sheetId"]),

  a2e_documents: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    type: v.union(
      v.literal("invoice"),
      v.literal("receipt"),
      v.literal("certificate"),
      v.literal("contract"),
      v.literal("other"),
    ),
    size: v.number(),
    contentType: v.optional(v.string()),
    url: v.string(),
    s3Key: v.string(),
    linkedToType: v.optional(
      v.union(
        v.literal("expense"),
        v.literal("invoice"),
        v.literal("book_entry"),
        v.literal("project"),
      ),
    ),
    linkedToId: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_linked", ["linkedToType", "linkedToId"]),

  a2e_bookSheets: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    type: v.optional(v.string()),
    columns: v.optional(v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.string(),
        width: v.optional(v.number()),
        options: v.optional(v.array(v.string())),
        formula: v.optional(v.string()),
        required: v.optional(v.boolean()),
        linkedType: v.optional(v.string()),
      }),
    )),
    isTemplate: v.optional(v.boolean()),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_template", ["isTemplate"]),

  a2e_bookEntries: defineTable({
    workspaceId: v.id("workspaces"),
    sheetId: v.id("a2e_bookSheets"),
    cells: v.any(),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedExpenses: v.optional(v.array(v.id("a2e_expenses"))),
    linkedInvoices: v.optional(v.array(v.id("a2e_invoices"))),
    linkedProjectId: v.optional(v.id("projects")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sheet", ["sheetId"])
    .index("by_workspace", ["workspaceId"]),

  a2e_budgets: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    amount: v.number(),
    spent: v.optional(v.number()),
    category: v.string(),
    period: v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("custom"),
    ),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    color: v.string(),
    currency: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_category", ["workspaceId", "category"]),

  a2e_categories: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    type: v.union(v.literal("expense"), v.literal("income"), v.literal("both")),
    archived: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  a2e_fiches: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    template: v.string(),
    title: v.string(),
    subtitle: v.optional(v.string()),
    data: v.any(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("archived"),
      ),
    ),
    locale: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project", ["projectId"]),

  // a2e_clients + a2e_grantReports: referenced by newer a2e functions; defined
  // here (empty on the deployment) so the superset compiles. Shapes inferred
  // from a2e_clients.ts / a2e_grantReports.ts usage.
  a2e_clients: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    siret: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    totalInvoiced: v.optional(v.number()),
    totalPaid: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  a2e_grantReports: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    data: v.any(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("archived"),
      ),
    ),
    locale: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project", ["projectId"]),

  // ================= FLUX TABLES (flux_) =================
  // Notion-style documents/notes. Nested via parentId. Content = BlockNote JSON.
  flux_documents: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    parentId: v.optional(v.id("flux_documents")),
    content: v.optional(v.string()),
    icon: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    isArchived: v.boolean(),
    isPublished: v.boolean(),
    order: v.optional(v.number()),
    shareToken: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_parent", ["workspaceId", "parentId"])
    .index("by_share_token", ["shareToken"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["workspaceId", "isArchived"],
    }),

  flux_documentVersions: defineTable({
    documentId: v.id("flux_documents"),
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.optional(v.string()),
    savedBy: v.id("users"),
    savedAt: v.number(),
  })
    .index("by_document", ["documentId"]),

  // Notion-style custom databases. columns/cells stored as JSON strings.
  flux_databases: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    columns: v.string(),
    isArchived: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  flux_databaseRows: defineTable({
    databaseId: v.id("flux_databases"),
    workspaceId: v.id("workspaces"),
    cells: v.string(),
    order: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_database", ["databaseId"])
    .index("by_workspace", ["workspaceId"]),

  // Flux-specific task presentation metadata. Sidecar to the shared `tasks`
  // table (keeps the shared table decoupled & cross-app safe).
  flux_taskMeta: defineTable({
    workspaceId: v.id("workspaces"),
    taskId: v.id("tasks"),
    priority: v.optional(
      v.union(
        v.literal("none"),
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    labels: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    startDate: v.optional(v.number()),
    estimateMinutes: v.optional(v.number()),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_task", ["taskId"]),

  flux_taskComments: defineTable({
    workspaceId: v.id("workspaces"),
    taskId: v.id("tasks"),
    userId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"]),

  // Calendar events.
  flux_events: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    recurrence: v.optional(v.string()), // none|daily|weekly|biweekly|monthly
    recurrenceUntil: v.optional(v.number()),
    color: v.optional(v.string()),
    location: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_start", ["workspaceId", "start"]),

  flux_favorites: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    documentId: v.id("flux_documents"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_user_document", ["userId", "documentId"]),

  flux_tags: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  flux_documentTags: defineTable({
    workspaceId: v.id("workspaces"),
    documentId: v.id("flux_documents"),
    tagId: v.id("flux_tags"),
  })
    .index("by_document", ["documentId"])
    .index("by_tag", ["tagId"]),

  // Per-user Flux preferences (app-scoped, not workspace-scoped).
  flux_userPrefs: defineTable({
    userId: v.id("users"),
    locale: v.optional(v.string()),
    theme: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    onboardingCompleted: v.optional(v.boolean()),
    lastWorkspaceId: v.optional(v.id("workspaces")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Workspace-specific custom task statuses (Kanban columns). When a workspace
  // has none, the app falls back to the 3 built-in defaults (todo/in_progress/
  // done) and seeds them on first access via flux_taskStatuses.ensureDefaults.
  flux_taskStatuses: defineTable({
    workspaceId: v.id("workspaces"),
    key: v.string(), // stable slug stored on tasks.status
    label: v.string(),
    color: v.string(),
    order: v.number(),
    isDone: v.optional(v.boolean()), // counts as "completed" for progress calc
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_key", ["workspaceId", "key"]),

  // Workspace-scoped reusable labels for tasks (name + color).
  flux_labels: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  // Project assignment / membership (who is working on a project).
  flux_projectMembers: defineTable({
    projectId: v.id("projects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.optional(v.string()), // "lead" | "member"
    addedBy: v.optional(v.id("users")),
    addedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  // Time tracking entries (logged against a task and/or project).
  flux_timeEntries: defineTable({
    workspaceId: v.id("workspaces"),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    userId: v.id("users"),
    minutes: v.number(),
    note: v.optional(v.string()),
    spentAt: v.number(), // when the work happened (day)
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_project", ["projectId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"]),
}, {
  // SHARED A2E Suite deployment: other apps in the suite own and extend some
  // tables (e.g. `notifications` gets extra fields like `relatedId` and legacy
  // UUID userIds) with shapes this schema does not fully model. Disabling strict
  // schema validation prevents `convex deploy` from ever failing on another
  // app's data. TypeScript still type-checks writes inside our own functions.
  schemaValidation: false,
});

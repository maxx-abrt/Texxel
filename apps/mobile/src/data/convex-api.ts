import { makeFunctionReference } from "convex/server";

/**
 * Convex function references.
 *
 * Declared by name instead of importing `convex/_generated/api` from
 * `apps/web`: Metro would then have to watch a folder outside the app, which
 * every Expo-in-a-monorepo setup pays for in flaky bundling. Names map 1:1 to
 * `apps/web/convex/<file>.ts` exports — keep them in sync when the backend
 * changes.
 */
const q = <A extends Record<string, any> = Record<string, any>, R = unknown>(name: string) =>
  makeFunctionReference<"query", A, R>(name);
const m = <A extends Record<string, any> = Record<string, any>, R = unknown>(name: string) =>
  makeFunctionReference<"mutation", A, R>(name);
const a = <A extends Record<string, any> = Record<string, any>, R = unknown>(name: string) =>
  makeFunctionReference<"action", A, R>(name);

export type Id = string;

export const convexApi = {
  users: {
    store: m<Record<string, never>, Id>("users:store"),
    me: q<Record<string, never>, ConvexUser | null>("users:me"),
    updateProfile: m<{ name?: string; image?: string }, Id>("users:updateProfile"),
  },
  workspaces: {
    listMine: q<Record<string, never>, ConvexWorkspace[]>("workspaces:listMine"),
    listMembers: q<{ workspaceId: Id }, ConvexMember[]>("workspaces:listMembers"),
  },
  coreSync: {
    syncFromCore: a<Record<string, never>, { synced: number }>("coreSync:syncFromCore"),
    stampCoreId: m<{ localWorkspaceId: Id; coreId: string }, { coreId: string }>(
      "coreSync:stampCoreId",
    ),
    importLocalMembers: a<
      { localWorkspaceId: Id },
      { imported: number; skipped: number; coreId: string | null }
    >("coreSync:importLocalMembers"),
  },
  projects: {
    list: q<{ workspaceId: Id }, ConvexProject[]>("projects:list"),
    create: m<
      {
        workspaceId: Id;
        name: string;
        client: string;
        status: "planning" | "active" | "completed" | "on_hold";
        startDate?: number;
        endDate?: number;
        description?: string;
        color?: string;
        autoCreateFiche?: boolean;
        locale?: string;
      },
      Id
    >("projects:create"),
    update: m<
      {
        projectId: Id;
        name?: string;
        client?: string;
        status?: "planning" | "active" | "completed" | "on_hold";
        startDate?: number | null;
        endDate?: number | null;
        description?: string;
        color?: string;
      },
      Id
    >("projects:update"),
    remove: m<{ projectId: Id }, null>("projects:remove"),
  },
  projectDetail: {
    detail: q<{ projectId: Id }, ConvexProjectDetail | null>("flux_projects:detail"),
    listMembers: q<{ projectId: Id }, ConvexProjectMember[]>("flux_projects:listMembers"),
    addMember: m<{ projectId: Id; userId: Id; role?: string }, Id>("flux_projects:addMember"),
    removeMember: m<{ projectId: Id; userId: Id }, boolean>("flux_projects:removeMember"),
  },
  tasks: {
    list: q<{ workspaceId: Id; projectId?: Id }, ConvexTask[]>("flux_tasks:list"),
    get: q<{ taskId: Id }, ConvexTask | null>("flux_tasks:get"),
    listChildren: q<{ parentId: Id }, ConvexTask[]>("flux_tasks:listChildren"),
    create: m<
      { workspaceId: Id; title: string; status?: string; priority?: string; dueDate?: number; projectId?: Id; assigneeId?: Id; description?: string; labels?: string[] },
      Id
    >("flux_tasks:create"),
    update: m<
      {
        taskId: Id;
        title?: string;
        description?: string;
        status?: string;
        priority?: "none" | "low" | "medium" | "high" | "urgent";
        assigneeId?: Id;
        dueDate?: number;
        startDate?: number;
        projectId?: Id;
        labels?: string[];
        order?: number;
        estimateMinutes?: number;
      },
      Id
    >("flux_tasks:update"),
    setStatus: m<{ taskId: Id; status: string }, null>("flux_tasks:setStatus"),
    remove: m<{ taskId: Id }, boolean>("flux_tasks:remove"),
    listComments: q<{ taskId: Id }, ConvexComment[]>("flux_tasks:listComments"),
    addComment: m<{ taskId: Id; content: string }, null>("flux_tasks:addComment"),
  },
  labels: {
    list: q<{ workspaceId: Id }, ConvexLabel[]>("flux_labels:list"),
    create: m<{ workspaceId: Id; name: string; color?: string }, Id>("flux_labels:create"),
  },
  taskStatuses: {
    list: q<{ workspaceId: Id }, ConvexTaskStatus[]>("flux_taskStatuses:list"),
  },
  documents: {
    list: q<{ workspaceId: Id }, ConvexDocument[]>("flux_documents:list"),
    get: q<{ documentId: Id }, ConvexDocument | null>("flux_documents:get"),
    create: m<{ workspaceId: Id; title?: string; parentId?: Id; icon?: string }, Id>("flux_documents:create"),
    update: m<{ documentId: Id; title?: string; content?: string; icon?: string }, Id>(
      "flux_documents:update",
    ),
    archive: m<{ documentId: Id }, Id>("flux_documents:archive"),
    listFavorites: q<{ workspaceId: Id }, ConvexDocument[]>("flux_documents:listFavorites"),
    toggleFavorite: m<{ documentId: Id }, boolean>("flux_documents:toggleFavorite"),
  },
  events: {
    list: q<{ workspaceId: Id; start?: number; end?: number }, ConvexEvent[]>("flux_events:list"),
    listExpanded: q<{ workspaceId: Id; start: number; end: number }, ConvexEvent[]>(
      "flux_events:listExpanded",
    ),
  },
  notifications: {
    listMine: q<{ limit?: number; unreadOnly?: boolean }, ConvexNotification[]>("notifications:listMine"),
    unreadCount: q<Record<string, never>, number>("notifications:unreadCount"),
    markAllRead: m<Record<string, never>, null>("notifications:markAllRead"),
    markRead: m<{ notificationId: Id }, null>("notifications:markRead"),
  },
  activities: {
    heatmap: q<{ workspaceId: Id; days?: number; mineOnly?: boolean }, ConvexHeatmap>("activities:heatmap"),
    list: q<{ workspaceId: Id; limit?: number }, ConvexActivity[]>("activities:list"),
  },
} as const;

// ─── Wire shapes returned by the Convex functions ────────────────────────────

export type ConvexUser = { _id: string; name: string | null; email: string | null; image: string | null };

export type ConvexWorkspace = {
  _id: string;
  name: string;
  slug: string;
  avatar?: string;
  description?: string;
  role: string;
  memberCount: number;
  coreId?: string;
};

export type ConvexMember = { _id?: string; userId?: string; name?: string | null; email?: string | null; image?: string | null; role?: string };

export type ConvexProject = {
  _id: string;
  name: string;
  client: string;
  status: "planning" | "active" | "completed" | "on_hold";
  color?: string;
  description?: string;
  endDate?: number;
  taskTotal: number;
  taskDone: number;
  memberCount: number;
};

export type ConvexTask = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  projectId?: string;
  parentId?: string;
  dueDate?: number;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  labels: string[];
  updatedAt: number;
  createdAt: number;
  assignee?: { _id: string; name?: string | null; email?: string | null; image?: string | null } | null;
};

export type ConvexTaskStatus = {
  _id: string | null;
  key: string;
  label: string;
  color: string;
  order: number;
  isDone?: boolean;
};

export type ConvexDocument = {
  _id: string;
  title: string;
  parentId?: string;
  content?: string;
  icon?: string;
  coverImage?: string;
  isFolder?: boolean;
  isArchived: boolean;
  isPublished: boolean;
  updatedAt: number;
  createdAt: number;
};

export type ConvexEvent = {
  _id: string;
  title: string;
  description?: string;
  start: number;
  end?: number;
  allDay?: boolean;
  color?: string;
};

export type ConvexNotification = {
  _id: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  read: boolean;
  link?: string;
  createdAt: number;
};

export type ConvexHeatmap = { counts: Record<string, number>; total: number };

export type ConvexActivity = {
  _id: string;
  action: string;
  targetType: string;
  createdAt: number;
  actor?: { name?: string | null; image?: string | null } | null;
  metadata?: Record<string, unknown>;
};

export type ConvexLabel = {
  _id: string;
  name: string;
  color?: string;
};

export type ConvexComment = {
  _id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: number;
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
};

export type ConvexProjectMember = {
  _id?: string;
  userId: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
};

export type ConvexProjectDetail = {
  project: {
    _id: string;
    name: string;
    client: string;
    status: "planning" | "active" | "completed" | "on_hold";
    color?: string;
    description?: string;
    startDate?: number;
    endDate?: number;
    workspaceId: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  };
  progress: { total: number; done: number; pct: number; byStatus: Record<string, number> };
  statuses: ConvexTaskStatus[];
  members: ConvexProjectMember[];
  recent: ConvexActivity[];
};

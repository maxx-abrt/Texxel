import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertWorkspaceMember,
  logActivity,
  notifyWorkspaceMembers,
  requireUserId,
} from "./lib/auth";
import { assertPermission, getUserPermissions, hasPermission } from "./flux_roles";
import { Id } from "./_generated/dataModel";

async function hydrate(ctx: any, workspaceId: Id<"workspaces">, tasks: any[]) {
  const metas = await ctx.db
    .query("flux_taskMeta")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
    .collect();
  const metaByTask = new Map(metas.map((m: any) => [m.taskId, m]));
  const userCache = new Map<string, any>();
  const getUser = async (id?: Id<"users">) => {
    if (!id) return null;
    if (userCache.has(id)) return userCache.get(id);
    const u = await ctx.db.get(id);
    const shaped = u ? { _id: u._id, name: u.name, email: u.email, image: u.image } : null;
    userCache.set(id, shaped);
    return shaped;
  };
  const out = [];
  for (const t of tasks) {
    const meta: any = metaByTask.get(t._id) ?? null;
    out.push({
      ...t,
      priority: meta?.priority ?? "none",
      labels: meta?.labels ?? [],
      order: meta?.order ?? t.createdAt,
      startDate: meta?.startDate,
      estimateMinutes: meta?.estimateMinutes,
      assignee: await getUser(t.assigneeId),
    });
  }
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function getTaskTree(ctx: any, taskId: Id<"tasks">): Promise<Id<"tasks">[]> {
  const out: Id<"tasks">[] = [taskId];
  const children = await ctx.db
    .query("tasks")
    .withIndex("by_parent", (q: any) => q.eq("parentId", taskId))
    .collect();
  for (const child of children) {
    out.push(...await getTaskTree(ctx, child._id));
  }
  return out;
}

async function getBinEntry(ctx: any, taskId: Id<"tasks">) {
  return await ctx.db
    .query("flux_taskBin")
    .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
    .unique();
}

async function isTaskDeleted(ctx: any, taskId: Id<"tasks">): Promise<boolean> {
  return (await getBinEntry(ctx, taskId)) != null;
}

async function deletedTaskIdsInWorkspace(ctx: any, workspaceId: Id<"workspaces">): Promise<Set<string>> {
  const entries = await ctx.db
    .query("flux_taskBin")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
    .collect();
  return new Set(entries.map((e: any) => e.taskId as string));
}

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    parentId: v.optional(v.union(v.id("tasks"), v.null())),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    let tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (args.projectId) tasks = tasks.filter((t) => t.projectId === args.projectId);
    // parentId === null → root tasks only; parentId = id → children of that task
    if (args.parentId !== undefined) {
      tasks = tasks.filter((t) =>
        args.parentId === null ? !t.parentId : t.parentId === args.parentId
      );
    }
    const perms = await getUserPermissions(ctx, args.workspaceId, userId);
    const canViewAll = perms.has("tasks:view");
    if (!canViewAll) {
      tasks = tasks.filter((t) => t.assigneeId === userId || t.createdBy === userId);
    }
    const deletedIds = await deletedTaskIdsInWorkspace(ctx, args.workspaceId);
    tasks = tasks.filter((t) => !deletedIds.has(t._id as string));
    return hydrate(ctx, args.workspaceId, tasks);
  },
});

export const listMine = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const deletedIds = await deletedTaskIdsInWorkspace(ctx, args.workspaceId);
    return hydrate(
      ctx,
      args.workspaceId,
      tasks.filter((t) => !deletedIds.has(t._id as string) && (t.assigneeId === userId || t.createdBy === userId)),
    );
  },
});

export const listChildren = query({
  args: { parentId: v.id("tasks") },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentId);
    if (!parent) return [];
    const { userId } = await assertWorkspaceMember(ctx, parent.workspaceId);
    let children = await ctx.db
      .query("tasks")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
    const perms = await getUserPermissions(ctx, parent.workspaceId, userId);
    const canViewAll = perms.has("tasks:view");
    if (!canViewAll) {
      children = children.filter((t) => t.assigneeId === userId || t.createdBy === userId);
    }
    const deletedIds = await deletedTaskIdsInWorkspace(ctx, parent.workspaceId);
    children = children.filter((t) => !deletedIds.has(t._id as string));
    return hydrate(ctx, parent.workspaceId, children);
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    if (await isTaskDeleted(ctx, args.taskId)) return null;
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId);
    const perms = await getUserPermissions(ctx, task.workspaceId, userId);
    const canViewAll = perms.has("tasks:view");
    if (!canViewAll && task.assigneeId !== userId && task.createdBy !== userId) {
      return null;
    }
    const meta = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .unique();
    const assignee = task.assigneeId ? await ctx.db.get(task.assigneeId) : null;
    return {
      ...task,
      priority: meta?.priority ?? "none",
      labels: meta?.labels ?? [],
      order: meta?.order ?? task.createdAt,
      startDate: meta?.startDate,
      estimateMinutes: meta?.estimateMinutes,
      assignee: assignee
        ? { _id: assignee._id, name: (assignee as any).name, email: (assignee as any).email, image: (assignee as any).image }
        : null,
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    parentId: v.optional(v.id("tasks")),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    labels: v.optional(v.array(v.string())),
    estimateMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertPermission(ctx, args.workspaceId, "tasks:manage");
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      parentId: args.parentId,
      title: args.title,
      description: args.description,
      status: args.status ?? "todo",
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("flux_taskMeta", {
      workspaceId: args.workspaceId,
      taskId,
      priority: args.priority ?? "none",
      labels: args.labels ?? [],
      order: now,
      startDate: args.startDate,
      estimateMinutes: args.estimateMinutes,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "task.created",
      targetType: "task",
      targetId: taskId,
      metadata: { title: args.title },
    });
    // Notify all workspace members (except creator) that a new task was created.
    await notifyWorkspaceMembers(ctx, {
      workspaceId: args.workspaceId,
      type: "task_created",
      title: "New task",
      message: args.title,
      link: `/tasks/${taskId}`,
      exceptUserId: userId,
      metadata: { taskId },
    });
    return taskId;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    labels: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    estimateMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const { userId } = await assertPermission(ctx, task.workspaceId, "tasks:manage");
    const now = Date.now();
    const assigneeChanged = args.assigneeId !== undefined && args.assigneeId !== task.assigneeId;
    if (assigneeChanged) {
      const canAssign = await hasPermission(ctx, task.workspaceId, userId, "tasks:assign");
      if (!canAssign) throw new Error("Forbidden: requires tasks:assign");
    }
    const taskPatch: any = { updatedAt: now };
    for (const k of ["title", "description", "status", "assigneeId", "dueDate", "projectId"] as const) {
      if ((args as any)[k] !== undefined) taskPatch[k] = (args as any)[k];
    }
    await ctx.db.patch(args.taskId, taskPatch);

    const meta = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .unique();
    const metaPatch: any = { updatedAt: now };
    for (const k of ["priority", "labels", "order", "startDate", "estimateMinutes"] as const) {
      if ((args as any)[k] !== undefined) metaPatch[k] = (args as any)[k];
    }
    if (meta) {
      await ctx.db.patch(meta._id, metaPatch);
    } else {
      await ctx.db.insert("flux_taskMeta", {
        workspaceId: task.workspaceId,
        taskId: args.taskId,
        priority: args.priority ?? "none",
        labels: args.labels ?? [],
        order: args.order ?? now,
        startDate: args.startDate,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Notify newly-assigned user.
    if (args.assigneeId && args.assigneeId !== task.assigneeId && args.assigneeId !== userId) {
      await ctx.db.insert("notifications", {
        userId: args.assigneeId,
        workspaceId: task.workspaceId,
        type: "task_assigned",
        title: "Task assigned to you",
        message: task.title,
        read: false,
        link: `/tasks/${args.taskId}`,
        createdAt: now,
      });
    }
    return args.taskId;
  },
});

export const setStatus = mutation({
  args: { taskId: v.id("tasks"), status: v.string(), order: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertPermission(ctx, task.workspaceId, "tasks:manage");
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
    if (args.order !== undefined) {
      const meta = await ctx.db
        .query("flux_taskMeta")
        .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
        .unique();
      if (meta) await ctx.db.patch(meta._id, { order: args.order, updatedAt: Date.now() });
      else
        await ctx.db.insert("flux_taskMeta", {
          workspaceId: task.workspaceId,
          taskId: args.taskId,
          priority: "none",
          labels: [],
          order: args.order,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
    }
  },
});

/** Bulk update many tasks at once (status / priority / assignee / project / dueDate / labels). */
export const bulkUpdate = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    dueDate: v.optional(v.union(v.number(), v.null())),
    labels: v.optional(v.array(v.string())),
    addLabels: v.optional(v.array(v.string())),
    removeLabels: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    startDate: v.optional(v.number()),
    estimateMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      await assertPermission(ctx, task.workspaceId, "tasks:manage");
      const taskPatch: any = { updatedAt: now };
      if (args.status !== undefined) taskPatch.status = args.status;
      if (args.assigneeId !== undefined) taskPatch.assigneeId = args.assigneeId ?? undefined;
      if (args.projectId !== undefined) taskPatch.projectId = args.projectId ?? undefined;
      if (args.dueDate !== undefined) taskPatch.dueDate = args.dueDate ?? undefined;
      await ctx.db.patch(taskId, taskPatch);

      const meta = await ctx.db
        .query("flux_taskMeta")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .unique();
      const metaPatch: any = { updatedAt: now };
      for (const k of ["priority", "order", "startDate", "estimateMinutes"] as const) {
        if ((args as any)[k] !== undefined) metaPatch[k] = (args as any)[k];
      }
      if (args.labels !== undefined || args.addLabels !== undefined || args.removeLabels !== undefined) {
        let labels = args.labels ?? meta?.labels ?? [];
        if (args.addLabels) labels = Array.from(new Set([...labels, ...args.addLabels]));
        if (args.removeLabels) labels = labels.filter((l: string) => !args.removeLabels!.includes(l));
        metaPatch.labels = labels;
      }
      if (meta) {
        if (Object.keys(metaPatch).length > 1) await ctx.db.patch(meta._id, metaPatch);
      } else if (Object.keys(metaPatch).length > 1) {
        await ctx.db.insert("flux_taskMeta", {
          workspaceId: task.workspaceId,
          taskId,
          priority: args.priority ?? "none",
          labels: metaPatch.labels ?? [],
          order: args.order ?? now,
          startDate: args.startDate,
          estimateMinutes: args.estimateMinutes,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return args.taskIds.length;
  },
});

/** Bulk create many tasks at once. */
export const bulkCreate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    tasks: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        priority: v.optional(
          v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
        ),
        assigneeId: v.optional(v.id("users")),
        projectId: v.optional(v.id("projects")),
        dueDate: v.optional(v.number()),
        startDate: v.optional(v.number()),
        labels: v.optional(v.array(v.string())),
        estimateMinutes: v.optional(v.number()),
        parentId: v.optional(v.id("tasks")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertPermission(ctx, args.workspaceId, "tasks:manage");
    const now = Date.now();
    let created = 0;
    for (const t of args.tasks) {
      const taskId = await ctx.db.insert("tasks", {
        workspaceId: args.workspaceId,
        projectId: t.projectId,
        parentId: t.parentId,
        title: t.title,
        description: t.description,
        status: t.status ?? "todo",
        assigneeId: t.assigneeId,
        dueDate: t.dueDate,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("flux_taskMeta", {
        workspaceId: args.workspaceId,
        taskId,
        priority: t.priority ?? "none",
        labels: t.labels ?? [],
        order: now,
        startDate: t.startDate,
        estimateMinutes: t.estimateMinutes,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
    return created;
  },
});

/** Recursively delete a task and all its descendants, including related data. */
async function deleteTaskTree(ctx: any, taskId: Id<"tasks">) {
  const task = await ctx.db.get(taskId);
  if (!task) return;
  const children = await ctx.db
    .query("tasks")
    .withIndex("by_parent", (q: any) => q.eq("parentId", taskId))
    .collect();
  for (const child of children) await deleteTaskTree(ctx, child._id);
  const meta = await ctx.db
    .query("flux_taskMeta")
    .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
    .unique();
  if (meta) await ctx.db.delete(meta._id);
  const comments = await ctx.db
    .query("flux_taskComments")
    .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
    .collect();
  for (const c of comments) await ctx.db.delete(c._id);
  const timeEntries = await ctx.db
    .query("flux_timeEntries")
    .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
    .collect();
  for (const entry of timeEntries) await ctx.db.delete(entry._id);
  await ctx.db.delete(taskId);
}

async function moveTaskTreeToBin(ctx: any, rootId: Id<"tasks">, deletedBy: Id<"users">, now: number) {
  const task = await ctx.db.get(rootId);
  if (!task) return;
  const tree = await getTaskTree(ctx, rootId);
  for (const taskId of tree) {
    if (await getBinEntry(ctx, taskId)) continue;
    await ctx.db.insert("flux_taskBin", {
      workspaceId: task.workspaceId,
      taskId,
      deletedBy,
      deletedAt: now,
      expiresAt: now + SEVEN_DAYS_MS,
    });
  }
}

/** Bulk delete tasks (move the whole subtree to the trash bin for 7 days). */
export const bulkRemove = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      const { userId } = await assertPermission(ctx, task.workspaceId, "tasks:manage");
      await moveTaskTreeToBin(ctx, taskId, userId, now);
    }
    return args.taskIds.length;
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const { userId } = await assertPermission(ctx, task.workspaceId, "tasks:manage");
    const now = Date.now();
    await moveTaskTreeToBin(ctx, args.taskId, userId, now);
    await logActivity(ctx, {
      workspaceId: task.workspaceId,
      actorId: userId,
      action: "task.deleted",
      targetType: "task",
      targetId: args.taskId,
    });
    return true;
  },
});

export const restore = mutation({
  args: { binId: v.id("flux_taskBin") },
  handler: async (ctx, args) => {
    const bin = await ctx.db.get(args.binId);
    if (!bin) throw new Error("Bin entry not found");
    const { userId } = await assertPermission(ctx, bin.workspaceId, "tasks:manage");
    const task = await ctx.db.get(bin.taskId);
    if (task && task.parentId) {
      const parentDeleted = await isTaskDeleted(ctx, task.parentId);
      if (parentDeleted) {
        await ctx.db.patch(task._id, { parentId: undefined, updatedAt: Date.now() });
      }
    }
    await ctx.db.delete(args.binId);
    await logActivity(ctx, {
      workspaceId: bin.workspaceId,
      actorId: userId,
      action: "task.restored",
      targetType: "task",
      targetId: bin.taskId,
    });
    return true;
  },
});

export const getTrash = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const binEntries = await ctx.db
      .query("flux_taskBin")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const tasks = [];
    for (const bin of binEntries) {
      const task = await ctx.db.get(bin.taskId);
      if (task) tasks.push({ ...task, binEntry: bin });
    }
    return hydrate(ctx, args.workspaceId, tasks);
  },
});

export const permanentlyDelete = mutation({
  args: { binId: v.id("flux_taskBin") },
  handler: async (ctx, args) => {
    const bin = await ctx.db.get(args.binId);
    if (!bin) throw new Error("Bin entry not found");
    await assertPermission(ctx, bin.workspaceId, "tasks:manage");
    await deleteTaskTree(ctx, bin.taskId);
    await ctx.db.delete(args.binId);
    return true;
  },
});

export const emptyExpiredTrash = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("flux_taskBin")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();
    for (const bin of expired) {
      await deleteTaskTree(ctx, bin.taskId);
      await ctx.db.delete(bin._id);
    }
    return expired.length;
  },
});

export const listComments = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId);
    const perms = await getUserPermissions(ctx, task.workspaceId, userId);
    const canViewAll = perms.has("tasks:view");
    if (!canViewAll && task.assigneeId !== userId && task.createdBy !== userId) {
      return [];
    }
    const comments = await ctx.db
      .query("flux_taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();
    const out = [] as any[];
    for (const c of comments) {
      const u: any = await ctx.db.get(c.userId);
      out.push({ ...c, user: u ? { name: u.name, email: u.email, image: u.image } : null });
    }
    return out;
  },
});

export const addComment = mutation({
  args: { taskId: v.id("tasks"), content: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId);
    const perms = await getUserPermissions(ctx, task.workspaceId, userId);
    const canView = perms.has("tasks:view");
    if (!canView && task.assigneeId !== userId && task.createdBy !== userId) {
      throw new Error("Forbidden");
    }
    await ctx.db.insert("flux_taskComments", {
      workspaceId: task.workspaceId,
      taskId: args.taskId,
      userId,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

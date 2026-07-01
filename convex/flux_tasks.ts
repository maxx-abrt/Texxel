import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertWorkspaceMember,
  logActivity,
  notifyWorkspaceMembers,
  requireUserId,
} from "./lib/auth";
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

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    parentId: v.optional(v.union(v.id("tasks"), v.null())),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
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
    return hydrate(ctx, args.workspaceId, tasks);
  },
})

export const listChildren = query({
  args: { parentId: v.id("tasks") },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentId);
    if (!parent) return [];
    await assertWorkspaceMember(ctx, parent.workspaceId);
    const children = await ctx.db
      .query("tasks")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
    return hydrate(ctx, parent.workspaceId, children);
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertWorkspaceMember(ctx, task.workspaceId);
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
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
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
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId, "member");
    const now = Date.now();
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
    await assertWorkspaceMember(ctx, task.workspaceId, "member");
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

/** Bulk update many tasks at once (status / priority / assignee / project). */
export const bulkUpdate = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      await assertWorkspaceMember(ctx, task.workspaceId, "member");
      const taskPatch: any = { updatedAt: now };
      if (args.status !== undefined) taskPatch.status = args.status;
      if (args.assigneeId !== undefined) taskPatch.assigneeId = args.assigneeId ?? undefined;
      if (args.projectId !== undefined) taskPatch.projectId = args.projectId ?? undefined;
      await ctx.db.patch(taskId, taskPatch);
      if (args.priority !== undefined) {
        const meta = await ctx.db
          .query("flux_taskMeta")
          .withIndex("by_task", (q) => q.eq("taskId", taskId))
          .unique();
        if (meta) await ctx.db.patch(meta._id, { priority: args.priority, updatedAt: now });
        else
          await ctx.db.insert("flux_taskMeta", {
            workspaceId: task.workspaceId,
            taskId,
            priority: args.priority,
            labels: [],
            order: now,
            createdAt: now,
            updatedAt: now,
          });
      }
    }
    return args.taskIds.length;
  },
});

/** Recursively delete a task and all its descendants. */
async function deleteTaskTree(ctx: any, taskId: Id<"tasks">) {
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
  await ctx.db.delete(taskId);
}

/** Bulk delete tasks (and their metas + comments + subtrees). */
export const bulkRemove = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      await assertWorkspaceMember(ctx, task.workspaceId, "member");
      await deleteTaskTree(ctx, taskId);
    }
    return args.taskIds.length;
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId, "member");
    await deleteTaskTree(ctx, args.taskId);
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

export const listComments = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    await assertWorkspaceMember(ctx, task.workspaceId);
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
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId, "member");
    await ctx.db.insert("flux_taskComments", {
      workspaceId: task.workspaceId,
      taskId: args.taskId,
      userId,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

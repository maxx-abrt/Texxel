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
      assignee: await getUser(t.assigneeId),
    });
  }
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export const list = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    let tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (args.projectId) tasks = tasks.filter((t) => t.projectId === args.projectId);
    return hydrate(ctx, args.workspaceId, tasks);
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
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
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
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    labels: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
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
    for (const k of ["priority", "labels", "order", "startDate"] as const) {
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
  args: { taskId: v.id("tasks"), status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")) },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertWorkspaceMember(ctx, task.workspaceId, "member");
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const { userId } = await assertWorkspaceMember(ctx, task.workspaceId, "member");
    const meta = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .unique();
    if (meta) await ctx.db.delete(meta._id);
    const comments = await ctx.db
      .query("flux_taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);
    await ctx.db.delete(args.taskId);
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

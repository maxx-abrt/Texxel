import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const requireAuth = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
};

const runMatchingAutomations = async (
  ctx: any,
  userId: string,
  taskId: any,
  trigger: "task_created" | "task_status_changed" | "task_due_soon" | "task_assigned",
  triggerValue?: string,
) => {
  const task = await ctx.db.get(taskId);
  if (!task) return;

  const autos = await ctx.db
    .query("automations")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", userId))
    .collect();

  const matching = autos.filter(
    (a: any) =>
      a.enabled &&
      a.trigger === trigger &&
      (!a.projectId || a.projectId === task.projectId) &&
      (!a.triggerValue || a.triggerValue === triggerValue),
  );

  for (const auto of matching) {
    switch (auto.action) {
      case "set_status":
        if (auto.actionValue) await ctx.db.patch(taskId, { status: auto.actionValue, updatedAt: Date.now() });
        break;
      case "set_priority":
        if (auto.actionValue) await ctx.db.patch(taskId, { priority: auto.actionValue, updatedAt: Date.now() });
        break;
      case "add_label":
        if (auto.actionValue) {
          const labels = task.labels ?? [];
          if (!labels.includes(auto.actionValue)) await ctx.db.patch(taskId, { labels: [...labels, auto.actionValue], updatedAt: Date.now() });
        }
        break;
      case "send_notification":
        await ctx.db.insert("notifications", {
          userId: task.createdBy,
          type: "reminder" as const,
          title: "reminder",
          body: auto.actionValue ?? auto.name,
          read: false,
          link: `/tasks/${taskId}`,
          relatedId: taskId as string,
          createdAt: Date.now(),
        });
        break;
      case "assign_to":
        if (auto.actionValue) await ctx.db.patch(taskId, { assigneeId: auto.actionValue, updatedAt: Date.now() });
        break;
    }
  }
};

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("in_review"), v.literal("done"), v.literal("cancelled"))),
    priority: v.optional(v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    workspaceId: v.optional(v.id("workspaces")),
    assigneeId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    parentTaskId: v.optional(v.id("tasks")),
    labels: v.optional(v.array(v.string())),
    estimateMinutes: v.optional(v.number()),
    blockedBy: v.optional(v.array(v.id("tasks"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status ?? "todo",
      priority: args.priority ?? "none",
      projectId: args.projectId,
      teamId: args.teamId,
      workspaceId: args.workspaceId,
      createdBy: userId,
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      startDate: args.startDate,
      parentTaskId: args.parentTaskId,
      labels: args.labels,
      estimateMinutes: args.estimateMinutes,
      blockedBy: args.blockedBy,
      createdAt: now,
      updatedAt: now,
    });

    if (args.assigneeId && args.assigneeId !== userId) {
      await ctx.db.insert("notifications", {
        userId: args.assigneeId,
        type: "task_assigned",
        title: "task_assigned",
        body: args.title,
        read: false,
        link: `/tasks/${taskId}`,
        relatedId: taskId,
        fromUserId: userId,
        createdAt: now,
      });
    }

    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId!))
        .collect();

      const creatorProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      for (const member of members) {
        if (member.userId === userId) continue;
        if (member.userId === args.assigneeId) continue;
        await ctx.db.insert("notifications", {
          userId: member.userId,
          type: "task_created_in_team",
          title: "task_created_in_team",
          body: args.title,
          read: false,
          link: `/tasks/${taskId}`,
          relatedId: taskId,
          fromUserId: userId,
          fromUserName: team?.name ?? "",
          fromUserImage: creatorProfile?.image,
          createdAt: now,
        });
      }
    }

    // Run automations for task_created trigger
    await runMatchingAutomations(ctx, userId, taskId, "task_created");

    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("in_review"), v.literal("done"), v.literal("cancelled"))),
    priority: v.optional(v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assigneeId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
    labels: v.optional(v.array(v.string())),
    estimateMinutes: v.optional(v.number()),
    blockedBy: v.optional(v.array(v.id("tasks"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    const now = Date.now();
    const { id, ...rest } = args;

    const updates: any = { ...rest, updatedAt: now };

    if (args.status === "done" && task.status !== "done") {
      updates.completedAt = now;
    }
    if (args.status && args.status !== "done") {
      updates.completedAt = undefined;
    }

    if (args.assigneeId && args.assigneeId !== task.assigneeId && args.assigneeId !== userId) {
      await ctx.db.insert("notifications", {
        userId: args.assigneeId,
        type: "task_assigned",
        title: "task_assigned",
        body: task.title,
        read: false,
        link: `/tasks/${id}`,
        relatedId: id,
        fromUserId: userId,
        createdAt: now,
      });
    }

    await ctx.db.patch(id, updates);

    // Run automations for status change
    if (args.status && args.status !== task.status) {
      await runMatchingAutomations(ctx, userId, id, "task_status_changed", args.status);
    }
    // Run automations for assignment
    if (args.assigneeId && args.assigneeId !== task.assigneeId) {
      await runMatchingAutomations(ctx, userId, id, "task_assigned", args.assigneeId);
    }

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Not found");
    if (task.createdBy !== userId) throw new Error("Not authorized");

    const comments = await ctx.db.query("taskComments").withIndex("by_task", (q) => q.eq("taskId", args.id)).collect();
    for (const c of comments) await ctx.db.delete(c._id);

    const subtasks = await ctx.db.query("tasks").filter((q) => q.eq(q.field("parentTaskId"), args.id)).collect();
    for (const s of subtasks) await ctx.db.delete(s._id);

    await ctx.db.delete(args.id);
  },
});

const enrichWithAssignee = async (ctx: any, tasks: any[]) => {
  const profileCache: Record<string, any> = {};
  return Promise.all(
    tasks.map(async (task) => {
      if (!task.assigneeId) return task;
      if (!profileCache[task.assigneeId]) {
        profileCache[task.assigneeId] = await ctx.db
          .query("userProfiles")
          .filter((q: any) => q.eq(q.field("userId"), task.assigneeId))
          .first();
      }
      const profile = profileCache[task.assigneeId];
      return {
        ...task,
        assigneeName: profile?.name ?? undefined,
        assigneeImage: profile?.image ?? undefined,
      };
    }),
  );
};

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();
    return enrichWithAssignee(ctx, tasks);
  },
});

export const getMyTasks = query({
  args: {
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("in_review"), v.literal("done"), v.literal("cancelled"))),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const assigned = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", userId))
      .collect();

    const created = await ctx.db
      .query("tasks")
      .withIndex("by_creator", (q) => q.eq("createdBy", userId))
      .collect();

    const all = [...assigned, ...created.filter((t) => !assigned.find((a) => a._id === t._id))];
    const byStatus = args.status ? all.filter((t) => t.status === args.status) : all.filter((t) => t.status !== "cancelled");
    const filtered = args.workspaceId
      ? byStatus.filter((t) => t.workspaceId === args.workspaceId)
      : byStatus;
    return enrichWithAssignee(ctx, filtered);
  },
});

export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();
    return enrichWithAssignee(ctx, tasks);
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const task = await ctx.db.get(args.id);
    if (!task) return null;

    let assigneeName: string | undefined;
    let assigneeImage: string | undefined;
    if (task.assigneeId) {
      const profile = await ctx.db
        .query("userProfiles")
        .filter((q) => q.eq(q.field("userId"), task.assigneeId))
        .first();
      assigneeName = profile?.name ?? undefined;
      assigneeImage = profile?.image ?? undefined;
    }

    return { ...task, assigneeName, assigneeImage };
  },
});

export const addComment = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const commentId = await ctx.db.insert("taskComments", {
      taskId: args.taskId,
      userId,
      userName: args.userName,
      userImage: args.userImage,
      content: args.content,
      createdAt: now,
    });

    const task = await ctx.db.get(args.taskId);
    if (task && task.createdBy !== userId) {
      await ctx.db.insert("notifications", {
        userId: task.createdBy,
        type: "task_comment",
        title: "task_comment",
        body: args.content.slice(0, 100),
        read: false,
        link: `/tasks/${args.taskId}`,
        relatedId: args.taskId,
        fromUserId: userId,
        fromUserName: args.userName,
        fromUserImage: args.userImage,
        createdAt: now,
      });
    }

    return commentId;
  },
});

export const getComments = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();
  },
});

export const getTaskStatsByProject = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_creator", (q) => q.eq("createdBy", identity.subject))
      .filter((q) => q.neq(q.field("projectId"), undefined))
      .collect();
    const stats: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.projectId) continue;
      const key = t.projectId as string;
      if (!stats[key]) stats[key] = { total: 0, done: 0 };
      stats[key].total += 1;
      if (t.status === "done") stats[key].done += 1;
    }
    return stats;
  },
});

export const getSubtasks = query({
  args: { parentTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const subtasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("parentTaskId"), args.parentTaskId))
      .collect();
    return enrichWithAssignee(ctx, subtasks);
  },
});

export const reorder = mutation({
  args: {
    id: v.id("tasks"),
    projectId: v.optional(v.id("projects")),
    newOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const siblings = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = siblings.findIndex((t) => t._id === args.id);
    if (idx === -1) return;
    const [moved] = siblings.splice(idx, 1);
    siblings.splice(args.newOrder, 0, moved);

    await Promise.all(siblings.map((t, i) => ctx.db.patch(t._id, { order: i })));
    return true;
  },
});

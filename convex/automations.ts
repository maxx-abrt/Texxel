import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const requireAuth = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
};

export const getMyAutomations = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    const all = await ctx.db
      .query("automations")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    if (!args.workspaceId) return all;
    return all.filter((a) => a.workspaceId === args.workspaceId);
  },
});

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("automations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    trigger: v.union(v.literal("task_created"), v.literal("task_status_changed"), v.literal("task_due_soon"), v.literal("task_assigned")),
    action: v.union(v.literal("set_status"), v.literal("set_priority"), v.literal("assign_to"), v.literal("send_notification"), v.literal("add_label")),
    triggerValue: v.optional(v.string()),
    actionValue: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return ctx.db.insert("automations", {
      ...args,
      ownerId: userId,
      enabled: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("automations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    trigger: v.optional(v.union(v.literal("task_created"), v.literal("task_status_changed"), v.literal("task_due_soon"), v.literal("task_assigned"))),
    action: v.optional(v.union(v.literal("set_status"), v.literal("set_priority"), v.literal("assign_to"), v.literal("send_notification"), v.literal("add_label"))),
    triggerValue: v.optional(v.string()),
    actionValue: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const auto = await ctx.db.get(args.id);
    if (!auto || auto.ownerId !== userId) throw new Error("Not authorized");
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const auto = await ctx.db.get(args.id);
    if (!auto || auto.ownerId !== userId) throw new Error("Not authorized");
    await ctx.db.delete(args.id);
  },
});

export const toggle = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const auto = await ctx.db.get(args.id);
    if (!auto || auto.ownerId !== userId) throw new Error("Not authorized");
    await ctx.db.patch(args.id, { enabled: !auto.enabled });
    return !auto.enabled;
  },
});

// Run automations when a task event occurs
export const runAutomations = mutation({
  args: {
    trigger: v.union(v.literal("task_created"), v.literal("task_status_changed"), v.literal("task_due_soon"), v.literal("task_assigned")),
    taskId: v.id("tasks"),
    triggerValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // Find matching automations
    const ownerAutos = await ctx.db
      .query("automations")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    const matching = ownerAutos.filter(
      (a) => a.enabled && a.trigger === args.trigger &&
        (!a.projectId || a.projectId === task.projectId) &&
        (!a.triggerValue || a.triggerValue === args.triggerValue),
    );

    for (const auto of matching) {
      switch (auto.action) {
        case "set_status":
          if (auto.actionValue) {
            await ctx.db.patch(args.taskId, { status: auto.actionValue as any, updatedAt: Date.now() });
          }
          break;
        case "set_priority":
          if (auto.actionValue) {
            await ctx.db.patch(args.taskId, { priority: auto.actionValue as any, updatedAt: Date.now() });
          }
          break;
        case "add_label":
          if (auto.actionValue) {
            const labels = task.labels ?? [];
            if (!labels.includes(auto.actionValue)) {
              await ctx.db.patch(args.taskId, { labels: [...labels, auto.actionValue], updatedAt: Date.now() });
            }
          }
          break;
        case "send_notification":
          await ctx.db.insert("notifications", {
            userId: task.createdBy,
            type: "reminder",
            title: "reminder",
            body: auto.actionValue ?? auto.name,
            read: false,
            link: `/tasks/${args.taskId}`,
            relatedId: args.taskId,
            createdAt: Date.now(),
          });
          break;
        case "assign_to":
          if (auto.actionValue) {
            await ctx.db.patch(args.taskId, { assigneeId: auto.actionValue, updatedAt: Date.now() });
          }
          break;
      }
    }
    return matching.length;
  },
});

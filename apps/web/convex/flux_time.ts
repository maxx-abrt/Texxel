import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, requireUserId, logActivity } from "./lib/auth";

async function shapeUser(ctx: any, id?: any) {
  if (!id) return null;
  const u = await ctx.db.get(id);
  return u ? { _id: u._id, name: u.name, email: u.email, image: u.image } : null;
}

/** List time entries for a task (newest first) + total. */
export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return { entries: [], totalMinutes: 0 };
    await assertWorkspaceMember(ctx, task.workspaceId);
    const rows = await ctx.db
      .query("flux_timeEntries")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    rows.sort((a, b) => b.spentAt - a.spentAt);
    const entries = [];
    for (const r of rows) entries.push({ ...r, user: await shapeUser(ctx, r.userId) });
    return { entries, totalMinutes: rows.reduce((a, r) => a + r.minutes, 0) };
  },
});

/** Add a time log entry to a task (and optionally roll up to its project). */
export const add = mutation({
  args: {
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    workspaceId: v.id("workspaces"),
    minutes: v.number(),
    note: v.optional(v.string()),
    spentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    if (args.minutes <= 0) throw new Error("Minutes must be positive");
    let projectId = args.projectId;
    if (!projectId && args.taskId) {
      const t = await ctx.db.get(args.taskId);
      projectId = t?.projectId ?? undefined;
    }
    const now = Date.now();
    const id = await ctx.db.insert("flux_timeEntries", {
      workspaceId: args.workspaceId,
      taskId: args.taskId,
      projectId,
      userId,
      minutes: Math.round(args.minutes),
      note: args.note,
      spentAt: args.spentAt ?? now,
      createdAt: now,
    });
    return id;
  },
});

export const remove = mutation({
  args: { entryId: v.id("flux_timeEntries") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.entryId);
    if (!e) return false;
    const { userId } = await assertWorkspaceMember(ctx, e.workspaceId, "member");
    // Author or admins can delete.
    await ctx.db.delete(args.entryId);
    return true;
  },
});

/** Aggregate time for a project: total tracked, estimated, per-member, recent. */
export const projectSummary = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) return null;
    await assertWorkspaceMember(ctx, p.workspaceId);

    const entries = await ctx.db
      .query("flux_timeEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const totalTracked = entries.reduce((a, e) => a + e.minutes, 0);

    // Sum estimates from this project's task metas.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const metas = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", p.workspaceId))
      .collect();
    const metaByTask = new Map(metas.map((m) => [m.taskId, m]));
    let totalEstimate = 0;
    for (const t of tasks) {
      const m = metaByTask.get(t._id);
      if (m?.estimateMinutes) totalEstimate += m.estimateMinutes;
    }

    // Per-member breakdown.
    const byUser = new Map<string, number>();
    for (const e of entries) byUser.set(e.userId, (byUser.get(e.userId) ?? 0) + e.minutes);
    const perMember = [];
    for (const [uid, minutes] of byUser) perMember.push({ user: await shapeUser(ctx, uid), minutes });
    perMember.sort((a, b) => b.minutes - a.minutes);

    return {
      totalTracked,
      totalEstimate,
      remaining: Math.max(0, totalEstimate - totalTracked),
      entryCount: entries.length,
      perMember,
    };
  },
});

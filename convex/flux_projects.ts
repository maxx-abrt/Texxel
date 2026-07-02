import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";
import { ensureChannel, addProjectMemberToChannel, removeProjectMemberFromChannel } from "./flux_chat";
import { assertPermission } from "./flux_roles";

async function shapeUser(ctx: any, id?: any) {
  if (!id) return null;
  const u = await ctx.db.get(id);
  return u ? { _id: u._id, name: u.name, email: u.email, image: u.image } : null;
}

/** Members explicitly assigned to a project. */
export const listMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) return [];
    await assertWorkspaceMember(ctx, p.workspaceId);
    const rows = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await shapeUser(ctx, r.userId);
      if (u) out.push({ ...r, ...u, userId: r.userId });
    }
    return out;
  },
});

export const addMember = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users"), role: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    const { userId: actorId } = await assertPermission(ctx, p.workspaceId, "projects:assign");
    const existing = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", args.userId))
      .unique();
    if (existing) {
      if (args.role) await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    const id = await ctx.db.insert("flux_projectMembers", {
      projectId: args.projectId,
      workspaceId: p.workspaceId,
      userId: args.userId,
      role: args.role ?? "member",
      addedBy: actorId,
      addedAt: Date.now(),
    });
    await addProjectMemberToChannel(ctx, args.projectId as any, args.userId as any, actorId as any);
    if (args.userId !== actorId) {
      await ctx.db.insert("notifications", {
        userId: args.userId,
        workspaceId: p.workspaceId,
        type: "project_assigned",
        title: "Added to a project",
        message: p.name,
        read: false,
        link: `/projects/${args.projectId}`,
        createdAt: Date.now(),
      });
    }
    await logActivity(ctx, {
      workspaceId: p.workspaceId,
      actorId,
      action: "project.member_added",
      targetType: "project",
      targetId: args.projectId,
    });
    return id;
  },
});

export const removeMember = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    await assertPermission(ctx, p.workspaceId, "projects:assign");
    const existing = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await removeProjectMemberFromChannel(ctx, args.projectId as any, args.userId as any);
    }
    return true;
  },
});

/** Full project detail: progress, task stats by status, members, recent activity. */
export const detail = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) return null;
    await assertWorkspaceMember(ctx, p.workspaceId);

    // Tasks + statuses.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const statusRows = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", p.workspaceId))
      .collect();
    const doneKeys = new Set(
      statusRows.length ? statusRows.filter((s) => s.isDone).map((s) => s.key) : ["done"],
    );
    const byStatus: Record<string, number> = {};
    let done = 0;
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (doneKeys.has(t.status)) done++;
    }
    const total = tasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Members.
    const memberRows = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const members = [];
    for (const r of memberRows) {
      const u = await shapeUser(ctx, r.userId);
      if (u) members.push({ ...u, userId: r.userId, role: r.role });
    }

    // Recent activity for this project.
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", p.workspaceId))
      .order("desc")
      .take(80);
    const recent = [];
    for (const a of activities) {
      if (a.targetId === args.projectId || (a as any).targetType === "project") {
        if (recent.length < 12) recent.push({ ...a, actor: await shapeUser(ctx, a.actorId) });
      }
    }

    return {
      project: p,
      progress: { total, done, pct, byStatus },
      statuses: statusRows.sort((a, b) => a.order - b.order),
      members,
      recent,
    };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];
    await assertWorkspaceMember(ctx, project.workspaceId);
    return ctx.db
      .query("a2e_grantReports")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("a2e_grantReports")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { reportId: v.id("a2e_grantReports") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reportId);
    if (!r) return null;
    await assertWorkspaceMember(ctx, r.workspaceId);
    return r;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    data: v.any(),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("a2e_grantReports", {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      title: args.title,
      data: args.data ?? {},
      status: "draft",
      locale: args.locale,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "grantReport.created",
      targetType: "grantReport",
      targetId: id,
      metadata: { title: args.title, projectId: args.projectId },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    reportId: v.id("a2e_grantReports"),
    title: v.optional(v.string()),
    data: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reportId);
    if (!r) throw new Error("Report not found");
    const { userId } = await assertWorkspaceMember(ctx, r.workspaceId, "member");
    const { reportId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(rest))
      if (v !== undefined) patch[k] = v;
    await ctx.db.patch(args.reportId, patch);
    return args.reportId;
  },
});

export const remove = mutation({
  args: { reportId: v.id("a2e_grantReports") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reportId);
    if (!r) return false;
    const { userId } = await assertWorkspaceMember(ctx, r.workspaceId, "admin");
    await ctx.db.delete(args.reportId);
    await logActivity(ctx, {
      workspaceId: r.workspaceId,
      actorId: userId,
      action: "grantReport.deleted",
      targetType: "grantReport",
      targetId: args.reportId,
    });
    return true;
  },
});

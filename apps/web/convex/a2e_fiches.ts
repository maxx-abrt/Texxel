import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    if (args.projectId) {
      const all = await ctx.db
        .query("a2e_fiches")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      return all.filter((f) => f.workspaceId === args.workspaceId).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return ctx.db
      .query("a2e_fiches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { ficheId: v.id("a2e_fiches") },
  handler: async (ctx, args) => {
    const f = await ctx.db.get(args.ficheId);
    if (!f) return null;
    await assertWorkspaceMember(ctx, f.workspaceId);
    return f;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    template: v.string(),
    title: v.string(),
    subtitle: v.optional(v.string()),
    data: v.optional(v.any()),
    projectId: v.optional(v.id("projects")),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(
      ctx,
      args.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_fiches", {
      workspaceId: args.workspaceId,
      template: args.template,
      title: args.title,
      subtitle: args.subtitle,
      data: args.data ?? {},
      status: "draft",
      projectId: args.projectId,
      locale: args.locale,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "fiche.created",
      targetType: "fiche",
      targetId: id,
      metadata: { title: args.title, template: args.template },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    ficheId: v.id("a2e_fiches"),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    data: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("archived"),
      ),
    ),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const f = await ctx.db.get(args.ficheId);
    if (!f) throw new Error("Fiche not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      f.workspaceId,
      "member",
    );
    const { ficheId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(rest))
      if (v !== undefined) patch[k] = v;
    await ctx.db.patch(args.ficheId, patch);
    return args.ficheId;
  },
});

export const duplicate = mutation({
  args: { ficheId: v.id("a2e_fiches") },
  handler: async (ctx, args) => {
    const f = await ctx.db.get(args.ficheId);
    if (!f) throw new Error("Fiche not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      f.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_fiches", {
      workspaceId: f.workspaceId,
      template: f.template,
      title: `${f.title} (copy)`,
      subtitle: f.subtitle,
      data: f.data,
      status: "draft",
      projectId: f.projectId,
      locale: f.locale,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const remove = mutation({
  args: { ficheId: v.id("a2e_fiches") },
  handler: async (ctx, args) => {
    const f = await ctx.db.get(args.ficheId);
    if (!f) return false;
    const { userId } = await assertWorkspaceMember(
      ctx,
      f.workspaceId,
      "member",
    );
    await ctx.db.delete(args.ficheId);
    await logActivity(ctx, {
      workspaceId: f.workspaceId,
      actorId: userId,
      action: "fiche.deleted",
      targetType: "fiche",
      targetId: args.ficheId,
    });
    return true;
  },
});

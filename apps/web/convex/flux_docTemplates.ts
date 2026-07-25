import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("flux_docTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const saveAsTemplate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.optional(v.string()),
    icon: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    return ctx.db.insert("flux_docTemplates", {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      icon: args.icon,
      category: args.category ?? "custom",
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { templateId: v.id("flux_docTemplates") },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.templateId);
    if (!t) return false;
    await assertWorkspaceMember(ctx, t.workspaceId, "member");
    await ctx.db.delete(args.templateId);
    return true;
  },
});

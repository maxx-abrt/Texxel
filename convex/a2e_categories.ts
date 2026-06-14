import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("a2e_categories")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    type: v.union(
      v.literal("expense"),
      v.literal("income"),
      v.literal("both"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(
      ctx,
      args.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_categories", {
      ...args,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "category.created",
      targetType: "category",
      targetId: id,
      metadata: { name: args.name },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("a2e_categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("expense"),
        v.literal("income"),
        v.literal("both"),
      ),
    ),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.categoryId);
    if (!c) throw new Error("Category not found");
    await assertWorkspaceMember(ctx, c.workspaceId, "member");
    const { categoryId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(rest))
      if (v !== undefined) patch[k] = v;
    await ctx.db.patch(args.categoryId, patch);
    return args.categoryId;
  },
});

export const remove = mutation({
  args: { categoryId: v.id("a2e_categories") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.categoryId);
    if (!c) return false;
    await assertWorkspaceMember(ctx, c.workspaceId, "admin");
    await ctx.db.delete(args.categoryId);
    return true;
  },
});

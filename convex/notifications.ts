import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, requireUserId } from "./lib/auth";

export const listMine = query({
  args: { unreadOnly: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const [uid] = (identity.subject as string).split("|");
    let q = ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q2) => q2.eq("userId", uid as any))
      .order("desc");
    const all = await q.take(args.limit ?? 50);
    if (args.unreadOnly) return all.filter((n) => !n.read);
    return all;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const [uid] = (identity.subject as string).split("|");
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", uid as any).eq("read", false))
      .collect();
    return rows.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const n = await ctx.db.get(args.id);
    if (!n) return;
    const userId = await requireUserId(ctx);
    if (n.userId !== userId) throw new Error("Forbidden");
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId).eq("read", false))
      .collect();
    for (const r of rows) await ctx.db.patch(r._id, { read: true });
  },
});

export const remove = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const n = await ctx.db.get(args.id);
    if (!n) return;
    const userId = await requireUserId(ctx);
    if (n.userId !== userId) throw new Error("Forbidden");
    await ctx.db.delete(args.id);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

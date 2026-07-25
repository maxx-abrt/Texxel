import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, requireUserId, getOptionalUserId } from "./lib/auth";

// Collect the set of userId keys this account may be stored under in the
// shared `notifications` table. Flux writes Convex `users._id`; some suite
// apps write the auth subject (or its "userId|session" prefix). We read both.
async function notifUserKeys(ctx: any): Promise<string[]> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return [];
  const keys = new Set<string>();
  const uid = await getOptionalUserId(ctx);
  if (uid) keys.add(uid as string);
  const legacy = (identity.subject as string).split("|")[0];
  if (legacy) keys.add(legacy);
  return Array.from(keys);
}

export const listMine = query({
  args: { unreadOnly: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const keys = await notifUserKeys(ctx);
    if (!keys.length) return [];
    const limit = args.limit ?? 50;
    const collected: any[] = [];
    for (const key of keys) {
      const rows = await ctx.db
        .query("notifications")
        .withIndex("by_user_created", (q2) => q2.eq("userId", key as any))
        .order("desc")
        .take(limit);
      collected.push(...rows);
    }
    const seen = new Set<string>();
    const merged = collected
      .filter((n) => (seen.has(n._id) ? false : (seen.add(n._id), true)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
    if (args.unreadOnly) return merged.filter((n) => !n.read);
    return merged;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const keys = await notifUserKeys(ctx);
    if (!keys.length) return 0;
    let count = 0;
    for (const key of keys) {
      const rows = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", key as any).eq("read", false))
        .collect();
      count += rows.length;
    }
    return count;
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

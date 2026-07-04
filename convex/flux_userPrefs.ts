import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireUserId } from "./lib/auth";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return null;
    const prefs = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return prefs;
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("flux_userPrefs", {
      userId,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    locale: v.optional(v.string()),
    theme: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    density: v.optional(v.string()),
    docToolbarHidden: v.optional(v.array(v.string())),
    onboardingCompleted: v.optional(v.boolean()),
    lastWorkspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("flux_userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    const patch: any = { updatedAt: now };
    for (const [k, val] of Object.entries(args)) if (val !== undefined) patch[k] = val;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("flux_userPrefs", {
      userId,
      onboardingCompleted: false,
      createdAt: now,
      ...patch,
    });
  },
});

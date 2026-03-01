import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getMyProfile = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
  },
});

export const upsertProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    onboardingCompleted: v.optional(v.boolean()),
    role: v.optional(v.string()),
    useCases: v.optional(v.array(v.string())),
    dueDateAlertsEnabled: v.optional(v.boolean()),
    dueDateAlertDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const now = Date.now();

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    } else {
      return ctx.db.insert("userProfiles", {
        userId,
        name: args.name,
        email: args.email,
        image: args.image,
        onboardingCompleted: args.onboardingCompleted ?? false,
        role: args.role,
        useCases: args.useCases,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const completeOnboarding = mutation({
  args: {
    role: v.optional(v.string()),
    useCases: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const now = Date.now();

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        onboardingCompleted: true,
        role: args.role,
        useCases: args.useCases,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        onboardingCompleted: true,
        role: args.role,
        useCases: args.useCases,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

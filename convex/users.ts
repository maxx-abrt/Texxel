import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getOptionalUserId, requireUserId } from "./lib/auth";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
      .unique();
    if (existing) {
      const updates: Partial<{ name: string; email: string; image: string }> = {};
      if (identity.name && identity.name !== existing.name) updates.name = identity.name;
      if (identity.email && identity.email !== existing.email) updates.email = identity.email;
      if (identity.pictureUrl && identity.pictureUrl !== existing.image) updates.image = identity.pictureUrl;
      if (Object.keys(updates).length > 0) await ctx.db.patch(existing._id, updates);
      return existing._id;
    }
    return ctx.db.insert("users", {
      externalId: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? undefined,
      image: identity.pictureUrl ?? undefined,
      createdAt: Date.now(),
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: (user as any).name ?? null,
      email: (user as any).email ?? null,
      image: (user as any).image ?? null,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const patch: any = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.image !== undefined) patch.image = args.image;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }
    return userId;
  },
});

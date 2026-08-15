import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

/** Convex Storage: get a short-lived upload URL (Bureau file storage). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Resolve a public URL for a stored file. */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

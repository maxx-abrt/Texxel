import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const requireAuth = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
};

// ─── Queries ────────────────────────────────────────────────────────────────

export const getDocumentThreads = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { threads: [], comments: [] };

    const threads = await ctx.db
      .query("documentThreads")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const comments = await ctx.db
      .query("documentThreadComments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return { threads, comments };
  },
});

export const getUserProfiles = query({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const profiles = await Promise.all(
      args.userIds.map((uid) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", uid))
          .first(),
      ),
    );
    return args.userIds.map((uid, i) => ({
      id: uid,
      username: profiles[i]?.name ?? "Unknown",
      avatarUrl: profiles[i]?.image ?? "",
    }));
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const createThread = mutation({
  args: {
    documentId: v.id("documents"),
    threadId: v.string(),
    commentId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    await ctx.db.insert("documentThreads", {
      documentId: args.documentId,
      threadId: args.threadId,
      resolved: false,
      createdAt: now,
      createdBy: userId,
    });
    await ctx.db.insert("documentThreadComments", {
      threadId: args.threadId,
      documentId: args.documentId,
      commentId: args.commentId,
      userId,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });
    return args.threadId;
  },
});

export const addComment = mutation({
  args: {
    documentId: v.id("documents"),
    threadId: v.string(),
    commentId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    await ctx.db.insert("documentThreadComments", {
      threadId: args.threadId,
      documentId: args.documentId,
      commentId: args.commentId,
      userId,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });
    return args.commentId;
  },
});

export const updateComment = mutation({
  args: {
    commentId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const comment = await ctx.db
      .query("documentThreadComments")
      .filter((q) => q.eq(q.field("commentId"), args.commentId))
      .first();
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== userId) throw new Error("Not authorized");
    await ctx.db.patch(comment._id, { body: args.body, updatedAt: Date.now() });
  },
});

export const deleteComment = mutation({
  args: { commentId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const comment = await ctx.db
      .query("documentThreadComments")
      .filter((q) => q.eq(q.field("commentId"), args.commentId))
      .first();
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== userId) throw new Error("Not authorized");
    await ctx.db.patch(comment._id, { deletedAt: Date.now() });
  },
});

export const deleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const thread = await ctx.db
      .query("documentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();
    if (!thread) return;
    if (thread.createdBy !== userId) throw new Error("Not authorized");
    await ctx.db.patch(thread._id, { deletedAt: Date.now() });
  },
});

export const resolveThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const thread = await ctx.db
      .query("documentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();
    if (!thread) return;
    await ctx.db.patch(thread._id, {
      resolved: true,
      resolvedBy: userId,
      resolvedAt: Date.now(),
    });
  },
});

export const unresolveThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const thread = await ctx.db
      .query("documentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();
    if (!thread) return;
    await ctx.db.patch(thread._id, {
      resolved: false,
      resolvedBy: undefined,
      resolvedAt: undefined,
    });
  },
});

export const addReaction = mutation({
  args: {
    commentId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const comment = await ctx.db
      .query("documentThreadComments")
      .filter((q) => q.eq(q.field("commentId"), args.commentId))
      .first();
    if (!comment) return;
    const reactions = comment.reactions ? JSON.parse(comment.reactions) : [];
    const existing = reactions.find((r: any) => r.emoji === args.emoji);
    if (existing) {
      if (!existing.userIds.includes(userId)) existing.userIds.push(userId);
    } else {
      reactions.push({ emoji: args.emoji, userIds: [userId], createdAt: Date.now() });
    }
    await ctx.db.patch(comment._id, { reactions: JSON.stringify(reactions) });
  },
});

export const deleteReaction = mutation({
  args: {
    commentId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const comment = await ctx.db
      .query("documentThreadComments")
      .filter((q) => q.eq(q.field("commentId"), args.commentId))
      .first();
    if (!comment) return;
    const reactions = comment.reactions ? JSON.parse(comment.reactions) : [];
    const updated = reactions
      .map((r: any) =>
        r.emoji === args.emoji
          ? { ...r, userIds: r.userIds.filter((id: string) => id !== userId) }
          : r,
      )
      .filter((r: any) => r.userIds.length > 0);
    await ctx.db.patch(comment._id, { reactions: JSON.stringify(updated) });
  },
});

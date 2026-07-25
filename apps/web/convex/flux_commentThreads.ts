import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

const reactionValidator = v.object({
  emoji: v.string(),
  createdAt: v.number(),
  userIds: v.array(v.id("users")),
});

function token(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function bodyText(body: any): string {
  const text: string[] = [];
  const walk = (blocks: any[]) => {
    for (const block of blocks ?? []) {
      for (const item of block?.content ?? []) {
        if (typeof item === "string") text.push(item);
        else if (typeof item?.text === "string") text.push(item.text);
        else if (typeof item?.content === "string") text.push(item.content);
      }
      walk(block?.children ?? []);
    }
  };
  walk(Array.isArray(body) ? body : []);
  return text.join(" ").trim();
}

async function notifyMentions(ctx: any, doc: any, authorId: any, body: any) {
  const text = bodyText(body).toLocaleLowerCase();
  if (!text.includes("@")) return;
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", doc.workspaceId))
    .collect();
  const author = await ctx.db.get(authorId);
  for (const membership of memberships) {
    if (String(membership.userId) === String(authorId)) continue;
    const user = await ctx.db.get(membership.userId);
    if (!user) continue;
    const labels = [user.name, user.email].filter(Boolean).map((label: string) => `@${label.toLocaleLowerCase()}`);
    if (!labels.some((label: string) => text.includes(label))) continue;
    await ctx.db.insert("notifications", {
      userId: membership.userId,
      workspaceId: doc.workspaceId,
      type: "comment_mention",
      title: `${author?.name ?? author?.email ?? "A teammate"} mentioned you`,
      message: `${doc.title || "Untitled"}: ${bodyText(body).slice(0, 140)}`,
      read: false,
      link: `/app/documents/${doc._id}`,
      createdAt: Date.now(),
    });
  }
}

async function getDocumentForRead(ctx: any, documentId: any) {
  const doc = await ctx.db.get(documentId);
  if (!doc) throw new Error("Document not found");
  await assertWorkspaceMember(ctx, doc.workspaceId, "viewer");
  return doc;
}

async function getDocumentForWrite(ctx: any, documentId: any) {
  const doc = await ctx.db.get(documentId);
  if (!doc) throw new Error("Document not found");
  const membership = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
  return { doc, ...membership };
}

async function materializeThread(ctx: any, thread: any) {
  const comments = await ctx.db
    .query("flux_commentMessages")
    .withIndex("by_thread", (q: any) => q.eq("threadId", thread.threadId))
    .order("asc")
    .collect();
  return {
    type: "thread" as const,
    id: thread.threadId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    resolved: thread.resolved,
    resolvedUpdatedAt: thread.resolvedUpdatedAt,
    resolvedBy: thread.resolvedBy ? String(thread.resolvedBy) : undefined,
    deletedAt: thread.deletedAt,
    metadata: thread.metadata ?? {},
    anchor: {
      from: thread.anchorFrom,
      to: thread.anchorTo,
      referenceText: thread.referenceText ?? "",
      updatedAt: thread.anchorUpdatedAt,
    },
    comments: comments.map((comment: any) => ({
      type: "comment" as const,
      id: comment.commentId,
      userId: String(comment.userId),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      body: comment.deletedAt ? undefined : comment.body,
      metadata: comment.metadata ?? {},
      reactions: comment.reactions ?? [],
    })),
  };
}

export const listForDocument = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    await getDocumentForRead(ctx, args.documentId);
    const threads = await ctx.db
      .query("flux_commentThreads")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();
    return Promise.all(threads.map((thread) => materializeThread(ctx, thread)));
  },
});

export const countOpen = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    await getDocumentForRead(ctx, args.documentId);
    const threads = await ctx.db
      .query("flux_commentThreads")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    return threads.filter((thread) => !thread.deletedAt && !thread.resolved).length;
  },
});

export const createThread = mutation({
  args: {
    documentId: v.id("flux_documents"),
    threadId: v.optional(v.string()),
    commentId: v.optional(v.string()),
    body: v.any(),
    metadata: v.optional(v.any()),
    commentMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { doc, userId } = await getDocumentForWrite(ctx, args.documentId);
    const now = Date.now();
    const threadId = args.threadId ?? token("thread");
    const commentId = args.commentId ?? token("comment");
    const existing = await ctx.db
      .query("flux_commentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", threadId))
      .unique();
    if (existing) throw new Error("Thread already exists");
    await ctx.db.insert("flux_commentThreads", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      threadId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      resolved: false,
      metadata: args.metadata,
    });
    await ctx.db.insert("flux_commentMessages", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      threadId,
      commentId,
      userId,
      body: args.body,
      metadata: args.commentMetadata,
      reactions: [],
      createdAt: now,
      updatedAt: now,
    });
    await notifyMentions(ctx, doc, userId, args.body);
    return { threadId, commentId, userId, now };
  },
});

export const addComment = mutation({
  args: {
    documentId: v.id("flux_documents"),
    threadId: v.string(),
    commentId: v.optional(v.string()),
    body: v.any(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { doc, userId } = await getDocumentForWrite(ctx, args.documentId);
    const thread = await ctx.db
      .query("flux_commentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!thread || thread.documentId !== args.documentId || thread.deletedAt) throw new Error("Thread not found");
    const now = Date.now();
    const commentId = args.commentId ?? token("comment");
    await ctx.db.insert("flux_commentMessages", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      threadId: args.threadId,
      commentId,
      userId,
      body: args.body,
      metadata: args.metadata,
      reactions: [],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { updatedAt: now });
    await notifyMentions(ctx, doc, userId, args.body);
    return { commentId, userId, now };
  },
});

export const updateComment = mutation({
  args: {
    documentId: v.id("flux_documents"),
    threadId: v.string(),
    commentId: v.string(),
    body: v.any(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { doc, userId } = await getDocumentForWrite(ctx, args.documentId);
    const comment = await ctx.db
      .query("flux_commentMessages")
      .withIndex("by_comment_id", (q) => q.eq("commentId", args.commentId))
      .unique();
    if (!comment || comment.threadId !== args.threadId || comment.documentId !== args.documentId) throw new Error("Comment not found");
    if (String(comment.userId) !== String(userId)) throw new Error("Only the author can edit this comment");
    await ctx.db.patch(comment._id, { body: args.body, metadata: args.metadata, updatedAt: Date.now() });
    await notifyMentions(ctx, doc, userId, args.body);
  },
});

export const deleteComment = mutation({
  args: { documentId: v.id("flux_documents"), threadId: v.string(), commentId: v.string() },
  handler: async (ctx, args) => {
    const { userId, role } = await getDocumentForWrite(ctx, args.documentId);
    const comment = await ctx.db
      .query("flux_commentMessages")
      .withIndex("by_comment_id", (q) => q.eq("commentId", args.commentId))
      .unique();
    if (!comment || comment.threadId !== args.threadId || comment.documentId !== args.documentId) throw new Error("Comment not found");
    if (String(comment.userId) !== String(userId) && role !== "owner" && role !== "admin") throw new Error("Forbidden");
    await ctx.db.patch(comment._id, { body: undefined, deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const deleteThread = mutation({
  args: { documentId: v.id("flux_documents"), threadId: v.string() },
  handler: async (ctx, args) => {
    const { userId, role } = await getDocumentForWrite(ctx, args.documentId);
    const thread = await ctx.db
      .query("flux_commentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!thread || thread.documentId !== args.documentId) throw new Error("Thread not found");
    if (String(thread.createdBy) !== String(userId) && role !== "owner" && role !== "admin") throw new Error("Forbidden");
    await ctx.db.patch(thread._id, { deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const setResolved = mutation({
  args: { documentId: v.id("flux_documents"), threadId: v.string(), resolved: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await getDocumentForWrite(ctx, args.documentId);
    const thread = await ctx.db
      .query("flux_commentThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!thread || thread.documentId !== args.documentId) throw new Error("Thread not found");
    const now = Date.now();
    await ctx.db.patch(thread._id, {
      resolved: args.resolved,
      resolvedBy: userId,
      resolvedUpdatedAt: now,
      updatedAt: now,
    });
  },
});

export const setReaction = mutation({
  args: {
    documentId: v.id("flux_documents"),
    threadId: v.string(),
    commentId: v.string(),
    emoji: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getDocumentForWrite(ctx, args.documentId);
    const comment = await ctx.db
      .query("flux_commentMessages")
      .withIndex("by_comment_id", (q) => q.eq("commentId", args.commentId))
      .unique();
    if (!comment || comment.threadId !== args.threadId || comment.documentId !== args.documentId) throw new Error("Comment not found");
    const current = (comment.reactions ?? []) as Array<{ emoji: string; createdAt: number; userIds: any[] }>;
    const existing = current.find((reaction) => reaction.emoji === args.emoji);
    let next;
    if (existing) {
      const users = existing.userIds.filter((id) => String(id) !== String(userId));
      if (args.active) users.push(userId);
      next = current
        .filter((reaction) => reaction.emoji !== args.emoji)
        .concat(users.length ? [{ ...existing, userIds: users }] : []);
    } else {
      next = args.active ? [...current, { emoji: args.emoji, createdAt: Date.now(), userIds: [userId] }] : current;
    }
    await ctx.db.patch(comment._id, { reactions: next, updatedAt: Date.now() });
  },
});

export const syncAnchors = mutation({
  args: {
    documentId: v.id("flux_documents"),
    anchors: v.array(v.object({
      threadId: v.string(),
      from: v.number(),
      to: v.number(),
      referenceText: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await getDocumentForWrite(ctx, args.documentId);
    const now = Date.now();
    for (const anchor of args.anchors.slice(0, 250)) {
      if (anchor.from < 0 || anchor.to <= anchor.from) continue;
      const thread = await ctx.db
        .query("flux_commentThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", anchor.threadId))
        .unique();
      if (!thread || thread.documentId !== args.documentId) continue;
      await ctx.db.patch(thread._id, {
        anchorFrom: Math.floor(anchor.from),
        anchorTo: Math.floor(anchor.to),
        referenceText: anchor.referenceText?.slice(0, 500),
        anchorUpdatedAt: now,
      });
    }
  },
});

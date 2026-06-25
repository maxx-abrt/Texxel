import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

/** List comments for a document, enriched with author + resolver info. */
export const listForDocument = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];
    await assertWorkspaceMember(ctx, doc.workspaceId);
    const comments = await ctx.db
      .query("flux_comments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();

    const out: any[] = [];
    for (const c of comments) {
      const author: any = await ctx.db.get(c.userId);
      out.push({
        ...c,
        author: author
          ? { _id: author._id, name: author.name ?? author.email ?? "Member", image: author.image ?? null }
          : null,
      });
    }
    return out;
  },
});

/** Add a comment. Notifies mentioned users + the document owner. */
export const add = mutation({
  args: {
    documentId: v.id("flux_documents"),
    content: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const text = args.content.trim();
    if (!text) throw new Error("Empty comment");
    const now = Date.now();

    const mentioned = Array.from(new Set((args.mentionedUserIds ?? []).map((m) => String(m))));

    const id = await ctx.db.insert("flux_comments", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      userId,
      content: text,
      mentionedUserIds: args.mentionedUserIds,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });

    const author: any = await ctx.db.get(userId);
    const authorName = author?.name ?? author?.email ?? "Someone";
    const notified = new Set<string>([String(userId)]);

    // Notify @mentioned users.
    for (const target of mentioned) {
      if (notified.has(target)) continue;
      notified.add(target);
      await ctx.db.insert("notifications", {
        userId: target,
        workspaceId: doc.workspaceId,
        type: "comment_mention",
        title: `${authorName} mentioned you in a comment`,
        message: `${doc.title || "a document"}: ${text.slice(0, 120)}`,
        read: false,
        link: `/documents/${args.documentId}`,
        createdAt: now,
      });
    }

    // Notify the document owner (if not the author and not already notified).
    if (!notified.has(String(doc.createdBy))) {
      await ctx.db.insert("notifications", {
        userId: doc.createdBy as any,
        workspaceId: doc.workspaceId,
        type: "comment",
        title: `${authorName} commented on your document`,
        message: `${doc.title || "a document"}: ${text.slice(0, 120)}`,
        read: false,
        link: `/documents/${args.documentId}`,
        createdAt: now,
      });
    }

    return id;
  },
});

/** Toggle resolved state of a comment. */
export const setResolved = mutation({
  args: { commentId: v.id("flux_comments"), resolved: v.boolean() },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.commentId);
    if (!c) throw new Error("Comment not found");
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId, "member");
    await ctx.db.patch(args.commentId, {
      resolved: args.resolved,
      resolvedBy: args.resolved ? userId : undefined,
      resolvedAt: args.resolved ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Delete a comment (author or workspace admin). */
export const remove = mutation({
  args: { commentId: v.id("flux_comments") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.commentId);
    if (!c) return false;
    const { userId, role } = await assertWorkspaceMember(ctx, c.workspaceId, "member");
    if (String(c.userId) !== String(userId) && role !== "admin" && role !== "owner") {
      throw new Error("Forbidden: only the author or an admin can delete this comment");
    }
    await ctx.db.delete(args.commentId);
    return true;
  },
});

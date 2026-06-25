import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertWorkspaceMember, logActivity, requireUserId, getOptionalUserId } from "./lib/auth";

function makeToken() {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  ).replace(/[^a-z0-9]/gi, "");
}

/** Whether a user can access a document given its visibility settings. */
function canAccessDoc(doc: any, userId: any): boolean {
  const vis = doc.visibility ?? "workspace";
  if (vis === "workspace") return true;
  if (String(doc.createdBy) === String(userId)) return true;
  if (vis === "custom") return (doc.accessUserIds ?? []).some((u: any) => String(u) === String(userId));
  return false; // private + not owner
}

/** All non-archived docs in a workspace the current user may see. */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const docs = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return docs
      .filter((d) => !d.isArchived && canAccessDoc(d, userId))
      .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
  },
});

export const get = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId);
    if (!canAccessDoc(doc, userId)) return null;
    return doc;
  },
});

/** Public read of a published doc by share token (no auth required). */
export const getPublic = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("flux_documents")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();
    if (!doc || !doc.isPublished || doc.isArchived) return null;
    return doc;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    parentId: v.optional(v.id("flux_documents")),
    icon: v.optional(v.string()),
    content: v.optional(v.string()),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("flux_documents", {
      workspaceId: args.workspaceId,
      title: args.title ?? "Untitled",
      parentId: args.parentId,
      icon: args.icon,
      content: args.content,
      visibility: args.visibility ?? "workspace",
      isArchived: false,
      isPublished: false,
      order: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "document.created",
      targetType: "flux_document",
      targetId: id,
      metadata: { title: args.title ?? "Untitled" },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    documentId: v.id("flux_documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    icon: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    parentId: v.optional(v.id("flux_documents")),
    order: v.optional(v.number()),
    visibility: v.optional(v.string()),
    accessUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    if (!canAccessDoc(doc, userId)) throw new Error("No access to this document");
    const { documentId, ...rest } = args;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.documentId, patch);
    return args.documentId;
  },
});

/** Parse mention nodes out of BlockNote content and notify mentioned users. */
export const processMentions = mutation({
  args: { documentId: v.id("flux_documents"), userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const seen = new Set<string>();
    for (const target of args.userIds) {
      if (String(target) === String(userId) || seen.has(String(target))) continue;
      seen.add(String(target));
      // Avoid duplicate mention notifications within a short window for same doc.
      await ctx.db.insert("notifications", {
        userId: target,
        workspaceId: doc.workspaceId,
        type: "mention",
        title: "You were mentioned",
        message: doc.title || "a document",
        read: false,
        link: `/documents/${args.documentId}`,
        createdAt: Date.now(),
      });
    }
    return true;
  },
});

/** Remove the cover image. */
export const removeCover = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.patch(args.documentId, { coverImage: undefined, updatedAt: Date.now() });
  },
});

export const removeIcon = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.patch(args.documentId, { icon: undefined, updatedAt: Date.now() });
  },
});

export const archive = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    // Recursively archive descendants.
    const queue: Id<"flux_documents">[] = [args.documentId];
    while (queue.length) {
      const current = queue.shift()!;
      await ctx.db.patch(current, { isArchived: true, updatedAt: Date.now() });
      const children = await ctx.db
        .query("flux_documents")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", doc.workspaceId).eq("parentId", current),
        )
        .collect();
      for (const c of children) queue.push(c._id);
    }
    await logActivity(ctx, {
      workspaceId: doc.workspaceId,
      actorId: userId,
      action: "document.archived",
      targetType: "flux_document",
      targetId: args.documentId,
    });
    return true;
  },
});

export const restore = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const patch: any = { isArchived: false, updatedAt: Date.now() };
    // If parent is archived, detach to root.
    if (doc.parentId) {
      const parent = await ctx.db.get(doc.parentId);
      if (parent?.isArchived) patch.parentId = undefined;
    }
    await ctx.db.patch(args.documentId, patch);
    return true;
  },
});

export const remove = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    // Delete descendants + versions + favorites + tag links.
    const queue: Id<"flux_documents">[] = [args.documentId];
    const toDelete: Id<"flux_documents">[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      toDelete.push(current);
      const children = await ctx.db
        .query("flux_documents")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", doc.workspaceId).eq("parentId", current),
        )
        .collect();
      for (const c of children) queue.push(c._id);
    }
    for (const docId of toDelete) {
      const versions = await ctx.db
        .query("flux_documentVersions")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .collect();
      for (const ver of versions) await ctx.db.delete(ver._id);
      const favs = await ctx.db
        .query("flux_favorites")
        .withIndex("by_user_document", (q) => q.eq("userId", userId).eq("documentId", docId))
        .collect();
      for (const f of favs) await ctx.db.delete(f._id);
      const tagLinks = await ctx.db
        .query("flux_documentTags")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .collect();
      for (const t of tagLinks) await ctx.db.delete(t._id);
      await ctx.db.delete(docId);
    }
    return true;
  },
});

export const getTrash = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const docs = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return docs.filter((d) => d.isArchived).sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const search = query({
  args: { workspaceId: v.id("workspaces"), query: v.string() },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    if (!args.query.trim()) {
      const docs = await ctx.db
        .query("flux_documents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      return docs.filter((d) => !d.isArchived).slice(0, 20);
    }
    return await ctx.db
      .query("flux_documents")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("workspaceId", args.workspaceId).eq("isArchived", false),
      )
      .take(20);
  },
});

export const setPublished = mutation({
  args: { documentId: v.id("flux_documents"), isPublished: v.boolean() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const patch: any = { isPublished: args.isPublished, updatedAt: Date.now() };
    if (args.isPublished && !doc.shareToken) patch.shareToken = makeToken();
    await ctx.db.patch(args.documentId, patch);
    return patch.shareToken ?? doc.shareToken ?? null;
  },
});

// ----- Versions -----
export const saveVersion = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    await ctx.db.insert("flux_documentVersions", {
      documentId: doc._id,
      workspaceId: doc.workspaceId,
      title: doc.title,
      content: doc.content,
      savedBy: userId,
      savedAt: Date.now(),
    });
  },
});

export const listVersions = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];
    await assertWorkspaceMember(ctx, doc.workspaceId);
    return await ctx.db
      .query("flux_documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(50);
  },
});

// ----- Favorites -----
export const toggleFavorite = mutation({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(ctx, doc.workspaceId);
    const existing = await ctx.db
      .query("flux_favorites")
      .withIndex("by_user_document", (q) => q.eq("userId", userId).eq("documentId", args.documentId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("flux_favorites", {
      userId,
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const listFavorites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return [];
    const favs = await ctx.db
      .query("flux_favorites")
      .withIndex("by_user_workspace", (q) => q.eq("userId", userId).eq("workspaceId", args.workspaceId))
      .collect();
    const out = [] as any[];
    for (const f of favs) {
      const doc = await ctx.db.get(f.documentId);
      if (doc && !doc.isArchived) out.push(doc);
    }
    return out;
  },
});

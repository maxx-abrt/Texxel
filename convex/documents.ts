import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const archive = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const exisingDocument = await ctx.db.get(args.id);

    if (!exisingDocument) {
      throw new Error("Document not found");
    }

    if (exisingDocument.userId !== userId) {
      throw new Error("Not authorized");
    }

    const recursiveArchive = async (documentId: Id<"documents">) => {
      const children = await ctx.db
        .query("documents")
        .withIndex("by_user_parent", (q) =>
          q.eq("userId", userId).eq("parentDocument", documentId),
        )
        .collect();

      for (const child of children) {
        await ctx.db.patch(child._id, {
          isArchived: true,
        });

        await recursiveArchive(child._id);
      }
    };

    const document = await ctx.db.patch(args.id, {
      isArchived: true,
    });

    recursiveArchive(args.id);

    return document;
  },
});

export const getSidebar = query({
  args: {
    parentDocument: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user_parent", (q) =>
        q.eq("userId", userId).eq("parentDocument", args.parentDocument),
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    documents.sort((a, b) => {
      if (a.order === undefined && b.order === undefined) {
        return a._creationTime > b._creationTime ? -1 : 1;
      }
      if (a.order === undefined) return -1;
      if (b.order === undefined) return 1;

      return a.order - b.order;
    });

    return documents;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    parentDocument: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const document = await ctx.db.insert("documents", {
      title: args.title,
      parentDocument: args.parentDocument,
      userId,
      isArchived: false,
      isPublished: false,
    });

    return document;
  },
});

export const createWithContent = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentDocument: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const document = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      icon: args.icon,
      parentDocument: args.parentDocument,
      userId,
      isArchived: false,
      isPublished: false,
    });

    return document;
  },
});

export const getTrash = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .order("desc")
      .collect();

    return documents;
  },
});

export const restore = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const exisingDocument = await ctx.db.get(args.id);

    if (!exisingDocument) {
      throw new Error("Document not found");
    }

    if (exisingDocument.userId !== userId) {
      throw new Error("Not authorized");
    }

    const recursiveRestore = async (documentId: Id<"documents">) => {
      const children = await ctx.db
        .query("documents")
        .withIndex("by_user_parent", (q) =>
          q.eq("userId", userId).eq("parentDocument", documentId),
        )
        .collect();

      for (const child of children) {
        await ctx.db.patch(child._id, {
          isArchived: false,
        });

        await recursiveRestore(child._id);
      }
    };

    const options: Partial<Doc<"documents">> = {
      isArchived: false,
    };

    if (exisingDocument.parentDocument) {
      const parent = await ctx.db.get(exisingDocument.parentDocument);

      if (parent?.isArchived) {
        options.parentDocument = undefined;
      }
    }

    const document = await ctx.db.patch(args.id, options);

    recursiveRestore(args.id);

    return document;
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const exisingDocument = await ctx.db.get(args.id);

    if (!exisingDocument) {
      throw new Error("Document not found");
    }

    if (exisingDocument.userId !== userId) {
      throw new Error("Not authorized");
    }

    const document = await ctx.db.delete(args.id);

    return document;
  },
});

export const getSearch = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return documents;
  },
});

export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new Error("Document not found");
    }

    if (document.isArchived) {
      throw new Error("Document is archived");
    }

    if (document.isPublished) {
      return document;
    }

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    if (document.userId === userId) {
      return document;
    }

    // Allow team members to access docs shared with their team
    if (document.sharedTeamId) {
      const member = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_user", (q: any) =>
          q.eq("teamId", document.sharedTeamId).eq("userId", userId),
        )
        .first();
      if (member) return document;
    }

    throw new Error("Not authorized");
  },
});

export const updateSharing = mutation({
  args: {
    id: v.id("documents"),
    isPublished: v.optional(v.boolean()),
    collaborationMode: v.optional(
      v.union(v.literal("view_only"), v.literal("open"), v.literal("restricted")),
    ),
    sharedTeamId: v.optional(v.id("teams")),
    allowedEditorEmails: v.optional(v.array(v.string())),
    guestCanEdit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not authorized");
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
    return true;
  },
});

export const generateShareToken = mutation({
  args: { id: v.id("documents"), guestCanEdit: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not authorized");
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await ctx.db.patch(args.id, {
      shareToken: token,
      guestCanEdit: args.guestCanEdit ?? true,
    });
    return token;
  },
});

export const revokeShareToken = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not authorized");
    await ctx.db.patch(args.id, { shareToken: undefined });
    return true;
  },
});

export const getByShareToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .first();
    if (!doc || doc.isArchived) return null;
    return doc;
  },
});

export const updateContentByToken = mutation({
  args: { token: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .first();
    if (!doc || doc.isArchived) throw new Error("Document not found");
    if (doc.guestCanEdit !== true) throw new Error("Document is read-only");
    await ctx.db.patch(doc._id, { content: args.content });
    return true;
  },
});

export const updateContentPublic = mutation({
  args: {
    id: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (!doc.isPublished) throw new Error("Document is not public");
    if (!doc.collaborationMode || doc.collaborationMode === "view_only") {
      throw new Error("Document is not editable");
    }
    // For restricted mode, check is handled on the client by revealing the doc only if invited
    await ctx.db.patch(args.id, { content: args.content });
    return true;
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const { id, ...rest } = args;

    const existingDocument = await ctx.db.get(args.id);

    if (!existingDocument) {
      throw new Error("Document not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const document = await ctx.db.patch(args.id, {
      ...rest,
    });

    return document;
  },
});

export const removeIcon = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const existingDocument = await ctx.db.get(args.id);

    if (!existingDocument) {
      throw new Error("Document not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const document = await ctx.db.patch(args.id, {
      icon: undefined,
    });

    return document;
  },
});

export const removeCoverImage = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const existingDocument = await ctx.db.get(args.id);

    if (!existingDocument) {
      throw new Error("Document not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const document = await ctx.db.patch(args.id, {
      coverImage: undefined,
    });

    return document;
  },
});

export const reorder = mutation({
  args: {
    id: v.id("documents"),
    parentDocument: v.optional(v.id("documents")),
    newOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const siblings = await ctx.db
      .query("documents")
      .withIndex("by_user_parent", (q) =>
        q.eq("userId", userId).eq("parentDocument", args.parentDocument),
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    siblings.sort((a, b) => {
      if (a.order === undefined && b.order === undefined) return 0;
      if (a.order === undefined) return -1;
      if (b.order === undefined) return 1;
      return a.order - b.order;
    });

    const itemIndex = siblings.findIndex((sibling) => sibling._id === args.id);
    const [movedItem] = siblings.splice(itemIndex, 1);
    siblings.splice(args.newOrder, 0, movedItem);

    await Promise.all(
      siblings.map((sibling, index) =>
        ctx.db.patch(sibling._id, {
          order: index,
        }),
      ),
    );

    return true;
  },
});

export const setParent = mutation({
  args: {
    id: v.id("documents"),
    parentDocument: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not authorized");
    if (args.parentDocument === args.id) throw new Error("Cannot be own parent");
    await ctx.db.patch(args.id, { parentDocument: args.parentDocument, order: 0 });
    return true;
  },
});

export const removeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .collect();

    const promises = documents.map((document) => ctx.db.delete(document._id));
    await Promise.all(promises);
    return true;
  },
});

export const getByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return ctx.db
      .query("documents")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();
  },
});

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();
  },
});

export const saveVersion = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.userId !== userId) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("documentVersions")
      .withIndex("by_document_time", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();

    if (existing.length >= 50) {
      await ctx.db.delete(existing[0]._id);
    }

    return ctx.db.insert("documentVersions", {
      documentId: args.documentId,
      content: doc.content ?? "",
      title: doc.title,
      savedAt: Date.now(),
      savedBy: userId,
      savedByName: identity.name ?? undefined,
      label: args.label,
    });
  },
});

export const getVersions = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) return [];

    return ctx.db
      .query("documentVersions")
      .withIndex("by_document_time", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();
  },
});

export const restoreVersion = mutation({
  args: { versionId: v.id("documentVersions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");
    const doc = await ctx.db.get(version.documentId);
    if (!doc || doc.userId !== userId) throw new Error("Not authorized");
    await ctx.db.patch(version.documentId, { content: version.content });
    return true;
  },
});

export const updatePresence = mutation({
  args: {
    documentId: v.id("documents"),
    userName: v.string(),
    userColor: v.string(),
    userImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const userId = identity.subject;
    const existing = await ctx.db
      .query("documentPresence")
      .withIndex("by_document_user", (q: any) =>
        q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        userName: args.userName,
        userColor: args.userColor,
        userImage: args.userImage,
      });
    } else {
      await ctx.db.insert("documentPresence", {
        documentId: args.documentId,
        userId,
        userName: args.userName,
        userColor: args.userColor,
        userImage: args.userImage,
        lastSeen: Date.now(),
      });
    }
  },
});

export const getDocumentPresence = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 30_000;
    return ctx.db
      .query("documentPresence")
      .withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
      .filter((q) => q.gte(q.field("lastSeen"), cutoff))
      .collect();
  },
});

export const removePresence = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const userId = identity.subject;
    const existing = await ctx.db
      .query("documentPresence")
      .withIndex("by_document_user", (q: any) =>
        q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const createTeamDocument = mutation({
  args: {
    title: v.string(),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    parentDocument: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q: any) => q.eq("teamId", args.teamId).eq("userId", userId))
      .first();
    if (!member) throw new Error("Not a team member");

    return ctx.db.insert("documents", {
      title: args.title,
      userId,
      isArchived: false,
      isPublished: false,
      teamId: args.teamId,
      projectId: args.projectId,
      parentDocument: args.parentDocument,
    });
  },
});

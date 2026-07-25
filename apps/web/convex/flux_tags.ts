import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return await ctx.db
      .query("flux_tags")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    return await ctx.db.insert("flux_tags", {
      workspaceId: args.workspaceId,
      name: args.name,
      color: args.color,
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { tagId: v.id("flux_tags") },
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.tagId);
    if (!tag) throw new Error("Tag not found");
    await assertWorkspaceMember(ctx, tag.workspaceId, "member");
    const links = await ctx.db
      .query("flux_documentTags")
      .withIndex("by_tag", (q) => q.eq("tagId", args.tagId))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);
    await ctx.db.delete(args.tagId);
    return true;
  },
});

export const getForDocument = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];
    await assertWorkspaceMember(ctx, doc.workspaceId);
    const links = await ctx.db
      .query("flux_documentTags")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    const out = [] as any[];
    for (const l of links) {
      const tag = await ctx.db.get(l.tagId);
      if (tag) out.push(tag);
    }
    return out;
  },
});

export const assignToDocument = mutation({
  args: { documentId: v.id("flux_documents"), tagId: v.id("flux_tags") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const existing = await ctx.db
      .query("flux_documentTags")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    if (existing.some((l) => l.tagId === args.tagId)) return;
    await ctx.db.insert("flux_documentTags", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      tagId: args.tagId,
    });
  },
});

export const removeFromDocument = mutation({
  args: { documentId: v.id("flux_documents"), tagId: v.id("flux_tags") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    const links = await ctx.db
      .query("flux_documentTags")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    for (const l of links) if (l.tagId === args.tagId) await ctx.db.delete(l._id);
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

const ALLOWED_FORMATS = new Set(["woff", "woff2", "ttf", "otf"]);
const MAX_FONT_SIZE = 10 * 1024 * 1024;

function cleanFamily(value: string) {
  const family = value.trim().replace(/[<>;{}\\]/g, "").replace(/\s+/g, " ").slice(0, 80);
  if (family.length < 2) throw new Error("Font family is too short");
  return family;
}

function parseGoogleUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid Google Fonts URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "fonts.googleapis.com" || !url.pathname.startsWith("/css")) {
    throw new Error("Only https://fonts.googleapis.com CSS URLs are supported");
  }
  const familyParam = url.searchParams.get("family");
  if (!familyParam) throw new Error("Google Fonts URL is missing a family");
  const family = cleanFamily(familyParam.split(":")[0].replace(/\+/g, " "));
  return { url: url.toString(), family };
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId, "viewer");
    const fonts = await ctx.db
      .query("flux_fonts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    return Promise.all(fonts.filter((font) => !font.deletedAt).map(async (font) => ({
      ...font,
      fileUrl: font.storageId ? await ctx.storage.getUrl(font.storageId) : undefined,
    })));
  },
});

export const createUploaded = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    family: v.string(),
    fileName: v.string(),
    format: v.string(),
    mimeType: v.string(),
    size: v.number(),
    weight: v.optional(v.number()),
    style: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const format = args.format.toLowerCase();
    if (!ALLOWED_FORMATS.has(format)) throw new Error("Unsupported font format");
    if (args.size <= 0 || args.size > MAX_FONT_SIZE) throw new Error("Font file must be 10 MB or smaller");
    const family = cleanFamily(args.family);
    const fileName = args.fileName.replace(/[<>\\/]/g, "").slice(0, 120);
    if (!fileName.toLowerCase().endsWith(`.${format}`)) throw new Error("Font filename and format do not match");
    return ctx.db.insert("flux_fonts", {
      workspaceId: args.workspaceId,
      family,
      sourceType: "upload",
      storageId: args.storageId,
      fileName,
      format,
      mimeType: args.mimeType.slice(0, 100),
      size: args.size,
      weight: Math.min(900, Math.max(100, args.weight ?? 400)),
      style: args.style === "italic" ? "italic" : "normal",
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const createGoogle = mutation({
  args: { workspaceId: v.id("workspaces"), cssUrl: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const parsed = parseGoogleUrl(args.cssUrl);
    const duplicate = await ctx.db
      .query("flux_fonts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("cssUrl"), parsed.url))
      .first();
    if (duplicate && !duplicate.deletedAt) return duplicate._id;
    return ctx.db.insert("flux_fonts", {
      workspaceId: args.workspaceId,
      family: parsed.family,
      sourceType: "google",
      cssUrl: parsed.url,
      format: "google",
      weight: 400,
      style: "normal",
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { fontId: v.id("flux_fonts") },
  handler: async (ctx, args) => {
    const font = await ctx.db.get(args.fontId);
    if (!font) return;
    const { userId, role } = await assertWorkspaceMember(ctx, font.workspaceId, "member");
    if (String(font.createdBy) !== String(userId) && role !== "admin" && role !== "owner") throw new Error("Forbidden");
    const styles = await ctx.db
      .query("flux_documentStyles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", font.workspaceId))
      .collect();
    if (styles.some((style) => style.fontId === args.fontId)) throw new Error("This font is still used by a document");
    if (font.storageId) await ctx.storage.delete(font.storageId);
    await ctx.db.patch(args.fontId, { deletedAt: Date.now() });
  },
});

export const getDocumentStyle = query({
  args: { documentId: v.id("flux_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    await assertWorkspaceMember(ctx, doc.workspaceId, "viewer");
    return ctx.db
      .query("flux_documentStyles")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
  },
});

export const setDocumentStyle = mutation({
  args: {
    documentId: v.id("flux_documents"),
    fontId: v.optional(v.id("flux_fonts")),
    fontFamily: v.optional(v.string()),
    fontSize: v.optional(v.number()),
    lineHeight: v.optional(v.number()),
    pageSize: v.optional(v.string()),
    marginTop: v.optional(v.number()),
    marginRight: v.optional(v.number()),
    marginBottom: v.optional(v.number()),
    marginLeft: v.optional(v.number()),
    headerEnabled: v.optional(v.boolean()),
    footerEnabled: v.optional(v.boolean()),
    headerText: v.optional(v.string()),
    footerText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertWorkspaceMember(ctx, doc.workspaceId, "member");
    if (args.fontId) {
      const font = await ctx.db.get(args.fontId);
      if (!font || font.workspaceId !== doc.workspaceId || font.deletedAt) throw new Error("Font not found in this workspace");
    }
    const existing = await ctx.db
      .query("flux_documentStyles")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
    const now = Date.now();
    const patch = {
      fontId: args.fontId,
      fontFamily: args.fontFamily ? cleanFamily(args.fontFamily) : "Plus Jakarta Sans",
      fontSize: Math.min(24, Math.max(12, args.fontSize ?? 16)),
      lineHeight: Math.min(2.2, Math.max(1.1, args.lineHeight ?? 1.65)),
      pageSize: ["A4", "LETTER", "LEGAL"].includes(args.pageSize ?? "") ? (args.pageSize as string) : "A4",
      marginTop: Math.min(96, Math.max(12, args.marginTop ?? 48)),
      marginRight: Math.min(96, Math.max(12, args.marginRight ?? 48)),
      marginBottom: Math.min(96, Math.max(12, args.marginBottom ?? 56)),
      marginLeft: Math.min(96, Math.max(12, args.marginLeft ?? 48)),
      headerEnabled: args.headerEnabled ?? false,
      footerEnabled: args.footerEnabled ?? true,
      headerText: args.headerText?.slice(0, 120),
      footerText: args.footerText?.slice(0, 120),
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return ctx.db.insert("flux_documentStyles", {
      workspaceId: doc.workspaceId,
      documentId: args.documentId,
      ...patch,
      createdAt: now,
    });
  },
});

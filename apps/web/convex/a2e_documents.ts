import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { api } from "./_generated/api";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

/**
 * Backblaze B2 storage (S3-compatible).
 * Env vars on the Convex backend:
 *   B2_REGION            (e.g. eu-central-003)
 *   B2_ENDPOINT          (e.g. https://s3.eu-central-003.backblazeb2.com)
 *   B2_KEY_ID            (S3 access key id)
 *   B2_APPLICATION_KEY   (S3 secret access key)
 *   B2_BUCKET_NAME       (e.g. A2E-Drive)
 *
 * We keep the legacy AWS_* env vars as fallbacks so old deployments keep working.
 */
function getS3() {
  const endpoint =
    process.env.B2_ENDPOINT ||
    (process.env.B2_REGION
      ? `https://s3.${process.env.B2_REGION}.backblazeb2.com`
      : process.env.S3_ENDPOINT);
  const region =
    process.env.B2_REGION || process.env.AWS_REGION || "eu-central-003";
  const accessKeyId = process.env.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID!;
  const secretAccessKey =
    process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY!;

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true, // required for Backblaze B2
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket() {
  return (
    process.env.B2_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    "A2E-Drive"
  );
}

function getEndpointHost() {
  const endpoint =
    process.env.B2_ENDPOINT ||
    (process.env.B2_REGION
      ? `https://s3.${process.env.B2_REGION}.backblazeb2.com`
      : null);
  if (endpoint) return endpoint.replace(/^https?:\/\//, "");
  const region = process.env.AWS_REGION || "eu-west-3";
  return `s3.${region}.amazonaws.com`;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Action: returns a presigned URL for direct upload to S3 from the browser. */
export const presignUpload = action({
  args: {
    workspaceId: v.id("workspaces"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> => {
    // Authorization via shared helper (action can't use ctx.db directly,
    // but the membership query runs through the public API).
    const member: any = await ctx.runQuery(
      api.workspaces.get,
      { workspaceId: args.workspaceId },
    );
    if (!member) throw new Error("Forbidden");

    if (args.size > 50 * 1024 * 1024) {
      throw new Error("File too large (max 50MB per file)");
    }

    const bucket = getBucket();
    const key = `workspaces/${args.workspaceId}/${Date.now()}-${safeFileName(
      args.fileName,
    )}`;
    const s3 = getS3();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: args.contentType,
      ContentLength: args.size,
    });
    const uploadUrl: string = await getSignedUrl(s3 as any, command as any, {
      expiresIn: 60 * 10, // 10 minutes
    });
    const publicUrl = `https://${getEndpointHost()}/${bucket}/${key}`;
    return { uploadUrl, key, publicUrl };
  },
});

/** Action: returns a presigned GET url to securely download. */
export const presignDownload = action({
  args: { documentId: v.id("a2e_documents") },
  handler: async (ctx, args): Promise<{ url: string; name: string } | null> => {
    const doc: any = await ctx.runQuery(api.a2e_documents.get, {
      documentId: args.documentId,
    });
    if (!doc) return null;
    const bucket = getBucket();
    const s3 = getS3();
    const url: string = await getSignedUrl(
      s3 as any,
      new GetObjectCommand({
        Bucket: bucket,
        Key: doc.s3Key,
        ResponseContentDisposition: `attachment; filename="${doc.name}"`,
      }) as any,
      { expiresIn: 60 * 10 },
    );
    return { url, name: doc.name };
  },
});

/** Action: returns a presigned GET url to PREVIEW inline (no download disposition). */
export const presignView = action({
  args: { documentId: v.id("a2e_documents") },
  handler: async (ctx, args): Promise<{ url: string; name: string; contentType?: string } | null> => {
    const doc: any = await ctx.runQuery(api.a2e_documents.get, {
      documentId: args.documentId,
    });
    if (!doc) return null;
    const bucket = getBucket();
    const s3 = getS3();
    const url: string = await getSignedUrl(
      s3 as any,
      new GetObjectCommand({
        Bucket: bucket,
        Key: doc.s3Key,
        ResponseContentType: doc.contentType,
      }) as any,
      { expiresIn: 60 * 30 },
    );
    return { url, name: doc.name, contentType: doc.contentType };
  },
});

/** List documents (optionally filtered by linked target). */
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    linkedToType: v.optional(
      v.union(
        v.literal("expense"),
        v.literal("invoice"),
        v.literal("book_entry"),
        v.literal("project"),
      ),
    ),
    linkedToId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const docs = await ctx.db
      .query("a2e_documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    if (args.linkedToType && args.linkedToId) {
      return docs.filter(
        (d) =>
          d.linkedToType === args.linkedToType &&
          d.linkedToId === args.linkedToId,
      );
    }
    return docs;
  },
});

export const get = query({
  args: { documentId: v.id("a2e_documents") },
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.documentId);
    if (!d) return null;
    await assertWorkspaceMember(ctx, d.workspaceId);
    return d;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    type: v.union(
      v.literal("invoice"),
      v.literal("receipt"),
      v.literal("certificate"),
      v.literal("contract"),
      v.literal("other"),
    ),
    size: v.number(),
    contentType: v.optional(v.string()),
    url: v.string(),
    s3Key: v.string(),
    linkedToType: v.optional(
      v.union(
        v.literal("expense"),
        v.literal("invoice"),
        v.literal("book_entry"),
        v.literal("project"),
      ),
    ),
    linkedToId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(
      ctx,
      args.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_documents", {
      ...args,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "document.uploaded",
      targetType: "document",
      targetId: id,
      metadata: {
        name: args.name,
        size: args.size,
        linkedToType: args.linkedToType,
        linkedToId: args.linkedToId,
      },
    });
    return id;
  },
});

export const linkDocument = mutation({
  args: {
    documentId: v.id("a2e_documents"),
    linkedToType: v.union(
      v.literal("expense"),
      v.literal("invoice"),
      v.literal("book_entry"),
      v.literal("project"),
    ),
    linkedToId: v.string(),
  },
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.documentId);
    if (!d) throw new Error("Document not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      d.workspaceId,
      "member",
    );
    await ctx.db.patch(args.documentId, {
      linkedToType: args.linkedToType,
      linkedToId: args.linkedToId,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: d.workspaceId,
      actorId: userId,
      action: "document.linked",
      targetType: "document",
      targetId: args.documentId,
      metadata: { to: args.linkedToType, id: args.linkedToId },
    });
    return args.documentId;
  },
});

export const remove = action({
  args: { documentId: v.id("a2e_documents") },
  handler: async (ctx, args): Promise<boolean> => {
    const doc: any = await ctx.runQuery(api.a2e_documents.get, {
      documentId: args.documentId,
    });
    if (!doc) return false;
    // Delete from S3
    try {
      const s3 = getS3();
      await s3.send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: doc.s3Key,
        }),
      );
    } catch (err) {
      console.error("S3 delete failed (continuing):", err);
    }
    await ctx.runMutation(api.a2e_documents.removeRecord, {
      documentId: args.documentId,
    });
    return true;
  },
});

export const removeRecord = mutation({
  args: { documentId: v.id("a2e_documents") },
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.documentId);
    if (!d) return false;
    const { userId } = await assertWorkspaceMember(
      ctx,
      d.workspaceId,
      "member",
    );
    await ctx.db.delete(args.documentId);
    await logActivity(ctx, {
      workspaceId: d.workspaceId,
      actorId: userId,
      action: "document.deleted",
      targetType: "document",
      targetId: args.documentId,
    });
    return true;
  },
});

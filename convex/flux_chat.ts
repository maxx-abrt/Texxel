import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, requireUserId } from "./lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function generateSlug(name: string, existing: string[]) {
  const base = slugify(name) || "channel";
  let slug = base;
  let i = 1;
  while (existing.includes(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function ensureChannel(
  ctx: any,
  workspaceId: string,
  name: string,
  type: "workspace" | "project" | "custom",
  createdBy: string,
  projectId?: string,
) {
  const existing = await ctx.db
    .query("flux_chatChannels")
    .withIndex("by_workspace_slug", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("slug", slugify(name)),
    )
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  const allSlugs = (
    await ctx.db
      .query("flux_chatChannels")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect()
  ).map((c: any) => c.slug);
  const slug = generateSlug(name, allSlugs);
  return await ctx.db.insert("flux_chatChannels", {
    workspaceId,
    name,
    slug,
    type,
    projectId,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

export const ensureWorkspaceChannel = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    return await ensureChannel(ctx, args.workspaceId as any, "general", "workspace", userId as any);
  },
});

export const ensureProjectChannel = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    const { userId } = await assertWorkspaceMember(ctx, p.workspaceId, "member");
    const name = `project-${p.name}`;
    const id = await ensureChannel(
      ctx,
      p.workspaceId as any,
      name,
      "project",
      userId as any,
      args.projectId as any,
    );
    await ctx.db.patch(id, { name: `project-${p.name}`, updatedAt: Date.now() });
    return id;
  },
});

export const createChannel = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    type: v.optional(v.union(v.literal("workspace"), v.literal("custom"))),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const allSlugs = (
      await ctx.db
        .query("flux_chatChannels")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).map((c: any) => c.slug);
    const now = Date.now();
    const slug = generateSlug(args.name, allSlugs);
    return await ctx.db.insert("flux_chatChannels", {
      workspaceId: args.workspaceId,
      name: args.name,
      slug,
      type: args.type ?? "custom",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getChannelByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) return null;
    await assertWorkspaceMember(ctx, p.workspaceId);
    const channel = await ctx.db
      .query("flux_chatChannels")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .unique();
    return channel;
  },
});

export const listChannels = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const channels = (
      await ctx.db
        .query("flux_chatChannels")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    const out: any[] = [];
    for (const c of channels) {
      const lastMessage = await ctx.db
        .query("flux_chatMessages")
        .withIndex("by_channel", (q: any) => q.eq("channelId", c._id))
        .order("desc")
        .take(1);
      const last = lastMessage[0];
      const author = last ? await ctx.db.get(last.userId) : null;
      out.push({
        ...c,
        lastMessage: last
          ? {
              ...last,
              author: author
                ? { _id: author._id, name: author.name, image: author.image }
                : null,
            }
          : null,
      });
    }
    return out;
  },
});

export const getChannel = query({
  args: { channelId: v.id("flux_chatChannels") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) return null;
    await assertWorkspaceMember(ctx, c.workspaceId);
    return c;
  },
});

async function enrichMessage(ctx: any, m: any, currentUserId?: string | null) {
  const author = await ctx.db.get(m.userId);
  const reactions = await ctx.db
    .query("flux_chatReactions")
    .withIndex("by_message", (q: any) => q.eq("messageId", m._id))
    .collect();
  const grouped: Record<string, { emoji: string; count: number; me: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, me: false };
    grouped[r.emoji].count++;
    if (currentUserId && r.userId === currentUserId) grouped[r.emoji].me = true;
  }
  const replyCount = m.parentId
    ? 0
    : await ctx.db
        .query("flux_chatMessages")
        .withIndex("by_parent", (q: any) => q.eq("parentId", m._id))
        .collect()
        .then((rows: any[]) => rows.length);
  return {
    ...m,
    author: author
      ? { _id: author._id, name: author.name ?? author.email, image: author.image }
      : null,
    reactions: Object.values(grouped),
    replyCount,
  };
}

export const listMessages = query({
  args: {
    channelId: v.id("flux_chatChannels"),
    parentId: v.optional(v.id("flux_chatMessages")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) return [];
    await assertWorkspaceMember(ctx, c.workspaceId);
    const userId = await requireUserId(ctx);
    const limit = Math.min(200, args.limit ?? 100);
    const q = args.parentId
      ? ctx.db
          .query("flux_chatMessages")
          .withIndex("by_parent", (q2: any) => q2.eq("parentId", args.parentId))
      : ctx.db
          .query("flux_chatMessages")
          .withIndex("by_channel", (q2: any) => q2.eq("channelId", args.channelId));
    const rows = await q.order("desc").take(limit);
    const enriched = [];
    for (const m of rows.reverse()) {
      if (m.deletedAt) continue;
      enriched.push(await enrichMessage(ctx, m, userId));
    }
    return enriched;
  },
});

export const sendMessage = mutation({
  args: {
    channelId: v.id("flux_chatChannels"),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          size: v.number(),
          contentType: v.optional(v.string()),
        }),
      ),
    ),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    mentionedEntities: v.optional(
      v.array(v.object({ type: v.string(), id: v.string(), name: v.optional(v.string()) })),
    ),
    parentId: v.optional(v.id("flux_chatMessages")),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId, "member");
    const text = args.content.trim();
    if (!text && !args.attachments?.length) throw new Error("Empty message");
    const now = Date.now();

    for (const a of args.attachments ?? []) {
      if (a.size > MAX_FILE_SIZE) throw new Error("Attachment too large (max 10 MB)");
    }

    const id = await ctx.db.insert("flux_chatMessages", {
      channelId: args.channelId,
      workspaceId: c.workspaceId,
      userId,
      content: text,
      attachments: args.attachments,
      mentionedUserIds: args.mentionedUserIds,
      mentionedEntities: args.mentionedEntities,
      parentId: args.parentId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.channelId, { updatedAt: now });

    // Update sender read cursor.
    await markReadInternal(ctx, userId, args.channelId, now, id);

    const author: any = await ctx.db.get(userId);
    const authorName = author?.name ?? author?.email ?? "Someone";
    const notified = new Set<string>([String(userId)]);

    // Notify @mentioned users.
    for (const target of args.mentionedUserIds ?? []) {
      if (notified.has(String(target))) continue;
      notified.add(String(target));
      await ctx.db.insert("notifications", {
        userId: target as any,
        workspaceId: c.workspaceId,
        type: "chat_mention",
        title: `${authorName} mentioned you in #${c.name}`,
        message: text.slice(0, 120),
        read: false,
        link: `/discussions?channel=${args.channelId}`,
        createdAt: now,
      });
    }

    // Notify parent message author of a reply.
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent && String(parent.userId) !== String(userId) && !notified.has(String(parent.userId))) {
        notified.add(String(parent.userId));
        await ctx.db.insert("notifications", {
          userId: parent.userId as any,
          workspaceId: c.workspaceId,
          type: "chat_reply",
          title: `${authorName} replied to you in #${c.name}`,
          message: text.slice(0, 120),
          read: false,
          link: `/discussions?channel=${args.channelId}&thread=${args.parentId}`,
          createdAt: now,
        });
      }
    }

    return id;
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("flux_chatMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.messageId);
    if (!m) throw new Error("Message not found");
    const { userId } = await assertWorkspaceMember(ctx, m.workspaceId, "member");
    if (String(m.userId) !== String(userId)) throw new Error("Forbidden");
    const text = args.content.trim();
    if (!text) throw new Error("Empty message");
    await ctx.db.patch(args.messageId, {
      content: text,
      editedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("flux_chatMessages") },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.messageId);
    if (!m) throw new Error("Message not found");
    const { userId, role } = await assertWorkspaceMember(ctx, m.workspaceId, "member");
    if (String(m.userId) !== String(userId) && role !== "admin" && role !== "owner") {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(args.messageId, { deletedAt: Date.now(), updatedAt: Date.now() });
    return true;
  },
});

export const addReaction = mutation({
  args: { messageId: v.id("flux_chatMessages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.messageId);
    if (!m) throw new Error("Message not found");
    const { userId } = await assertWorkspaceMember(ctx, m.workspaceId, "member");
    const existing = await ctx.db
      .query("flux_chatReactions")
      .withIndex("by_message", (q: any) => q.eq("messageId", args.messageId))
      .collect();
    const already = existing.find((r: any) => r.userId === userId && r.emoji === args.emoji);
    if (already) {
      await ctx.db.delete(already._id);
      return false;
    }
    await ctx.db.insert("flux_chatReactions", {
      messageId: args.messageId,
      userId,
      emoji: args.emoji,
      createdAt: Date.now(),
    });
    return true;
  },
});

async function markReadInternal(
  ctx: any,
  userId: string,
  channelId: string,
  at: number,
  messageId?: string,
) {
  const existing = await ctx.db
    .query("flux_chatUserReads")
    .withIndex("by_user_channel", (q: any) => q.eq("userId", userId).eq("channelId", channelId))
    .unique();
  const patch: any = { lastReadAt: at, updatedAt: at };
  if (messageId) patch.lastMessageId = messageId;
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("flux_chatUserReads", {
      userId,
      channelId,
      lastReadAt: at,
      lastMessageId: messageId,
      updatedAt: at,
    });
  }
}

export const markRead = mutation({
  args: { channelId: v.id("flux_chatChannels") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    const userId = await requireUserId(ctx);
    await assertWorkspaceMember(ctx, c.workspaceId);
    const now = Date.now();
    await markReadInternal(ctx, userId, args.channelId, now);
    return true;
  },
});

async function getUnreadCounts(ctx: any, workspaceId: string, userId: string) {
  const channels = await ctx.db
    .query("flux_chatChannels")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
    .collect();
  const reads = await ctx.db
    .query("flux_chatUserReads")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const readMap = new Map(reads.map((r: any) => [r.channelId, r.lastReadAt]));
  const out: { channelId: string; count: number }[] = [];
  for (const c of channels) {
    const lastRead = readMap.get(c._id) ?? 0;
    const messages = await ctx.db
      .query("flux_chatMessages")
      .withIndex("by_channel", (q2: any) => q2.eq("channelId", c._id))
      .collect();
    const count = messages.filter(
      (m: any) => m.createdAt > lastRead && !m.deletedAt && String(m.userId) !== String(userId),
    ).length;
    out.push({ channelId: c._id, count });
  }
  return out;
}

export const unreadCounts = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const userId = await requireUserId(ctx);
    return getUnreadCounts(ctx, args.workspaceId as any, userId as any);
  },
});

export const totalUnread = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const userId = await requireUserId(ctx);
    const counts = await getUnreadCounts(ctx, args.workspaceId as any, userId as any);
    return counts.reduce((sum: number, c: { count: number }) => sum + c.count, 0);
  },
});

export const mentionables = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const users: any[] = [];
    for (const m of memberships) {
      const u = await ctx.db.get(m.userId);
      if (u) {
        users.push({
          type: "user",
          id: u._id,
          name: u.name ?? u.email,
          image: u.image,
          subtitle: u.email,
        });
      }
    }
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const docs = await ctx.db
      .query("flux_documents")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return [
      ...users,
      ...projects.map((p: any) => ({
        type: "project",
        id: p._id,
        name: p.name,
        subtitle: "Project",
      })),
      ...tasks.map((t: any) => ({
        type: "task",
        id: t._id,
        name: t.title,
        subtitle: "Task",
      })),
      ...docs.map((d: any) => ({
        type: "document",
        id: d._id,
        name: d.title,
        subtitle: "Document",
      })),
    ];
  },
});

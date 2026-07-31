import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceAdmin, assertWorkspaceMember, requireUserId } from "./lib/auth";
import { getUserPermissions } from "./flux_roles";

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

async function getChannelMembership(
  ctx: any,
  channelId: string,
  userId: string,
) {
  return await ctx.db
    .query("flux_channelMembers")
    .withIndex("by_channel_user", (q: any) =>
      q.eq("channelId", channelId).eq("userId", userId),
    )
    .unique();
}

async function canViewChannel(
  ctx: any,
  channel: any,
  userId: string,
  permissions: Set<string>,
) {
  if (permissions.has("channels:manage")) return true;
  if (channel.visibility === "public") return true;
  const member = await getChannelMembership(ctx, channel._id, userId);
  return !!member;
}

async function canPostInChannel(
  ctx: any,
  channel: any,
  userId: string,
  permissions: Set<string>,
) {
  if (permissions.has("channels:manage")) return true;
  const member = await getChannelMembership(ctx, channel._id, userId);
  if (channel.postPermission === "admin") return false;
  if (channel.postPermission === "moderator") {
    return member?.role === "moderator";
  }
  // "all" or unset: public channel requires channels:post; private requires membership + channels:post.
  if (channel.visibility === "public") return permissions.has("channels:post");
  return (
    !!member &&
    (member.role === "poster" || member.role === "moderator") &&
    permissions.has("channels:post")
  );
}

async function canManageChannel(
  ctx: any,
  channel: any,
  userId: string,
  permissions: Set<string>,
) {
  if (permissions.has("channels:manage")) return true;
  const member = await getChannelMembership(ctx, channel._id, userId);
  return member?.role === "moderator";
}

async function getChannelPermissions(ctx: any, workspaceId: string, userId: string) {
  return await getUserPermissions(ctx, workspaceId, userId);
}

export async function addProjectMemberToChannel(
  ctx: any,
  projectId: string,
  userId: string,
  addedBy: string,
) {
  const channel = await ctx.db
    .query("flux_chatChannels")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .unique();
  if (!channel) return;
  await addChannelMemberInternal(ctx, channel, userId, "poster", addedBy);
}

export async function removeProjectMemberFromChannel(
  ctx: any,
  projectId: string,
  userId: string,
) {
  const channel = await ctx.db
    .query("flux_chatChannels")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .unique();
  if (!channel) return;
  const existing = await getChannelMembership(ctx, channel._id, userId);
  if (existing) await ctx.db.delete(existing._id);
}

async function addChannelMemberInternal(
  ctx: any,
  channel: any,
  userId: string,
  role: "viewer" | "poster" | "moderator",
  addedBy?: string,
) {
  const existing = await getChannelMembership(ctx, channel._id, userId);
  if (existing) {
    if (existing.role !== role) {
      await ctx.db.patch(existing._id, { role, updatedAt: Date.now() });
    }
    return existing._id;
  }
  return await ctx.db.insert("flux_channelMembers", {
    channelId: channel._id,
    workspaceId: channel.workspaceId,
    userId,
    role,
    addedBy,
    joinedAt: Date.now(),
  });
}

export async function ensureChannel(
  ctx: any,
  workspaceId: string,
  name: string,
  type: "workspace" | "project" | "custom",
  createdBy: string,
  projectId?: string,
  defaults?: { visibility?: "public" | "private"; postPermission?: "all" | "admin" | "moderator" },
) {
  const existing = await ctx.db
    .query("flux_chatChannels")
    .withIndex("by_workspace_slug", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("slug", slugify(name)),
    )
    .unique();
  if (existing) {
    // If a project channel already existed before permissions, ensure the creator is a member.
    if (type === "project" && projectId) {
      await addChannelMemberInternal(ctx, existing, createdBy, "moderator", createdBy);
    }
    return existing._id;
  }
  const now = Date.now();
  const allSlugs = (
    await ctx.db
      .query("flux_chatChannels")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .collect()
  ).map((c: any) => c.slug);
  const slug = generateSlug(name, allSlugs);
  const visibility = defaults?.visibility ?? (type === "project" ? "private" : "public");
  const postPermission = defaults?.postPermission ?? "all";
  const id = await ctx.db.insert("flux_chatChannels", {
    workspaceId,
    name,
    slug,
    type,
    projectId,
    visibility,
    postPermission,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
  await addChannelMemberInternal(ctx, { _id: id, workspaceId }, createdBy, "moderator", createdBy);
  return id;
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
    // Ensure all current project members are in the channel.
    const projectMembers = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .collect();
    const channel = await ctx.db.get(id);
    if (channel) {
      for (const m of projectMembers) {
        await addChannelMemberInternal(ctx, channel, m.userId, "poster", userId);
      }
    }
    return id;
  },
});

export const createChannel = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    type: v.optional(v.union(v.literal("workspace"), v.literal("custom"))),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    postPermission: v.optional(v.union(v.literal("all"), v.literal("admin"), v.literal("moderator"))),
    description: v.optional(v.string()),
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
    const type = args.type ?? "custom";
    const id = await ctx.db.insert("flux_chatChannels", {
      workspaceId: args.workspaceId,
      name: args.name,
      slug,
      type,
      visibility: args.visibility ?? "public",
      postPermission: args.postPermission ?? "all",
      description: args.description,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await addChannelMemberInternal(ctx, { _id: id, workspaceId: args.workspaceId }, userId, "moderator", userId);
    return id;
  },
});

export const getChannelByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) return null;
    const { userId } = await assertWorkspaceMember(ctx, p.workspaceId);
    const permissions = await getChannelPermissions(ctx, p.workspaceId, userId);
    const channel = await ctx.db
      .query("flux_chatChannels")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .unique();
    if (!channel) return null;
    const ok = await canViewChannel(ctx, channel, userId, permissions);
    if (!ok) return null;
    const member = await getChannelMembership(ctx, channel._id, userId);
    const canManage = permissions.has("channels:manage") || member?.role === "moderator";
    const canPost = await canPostInChannel(ctx, channel, userId, permissions);
    return { ...channel, membership: member ? { role: member.role } : null, canManage, canPost };
  },
});

export const listChannels = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const permissions = await getChannelPermissions(ctx, args.workspaceId, userId);
    const channels = (
      await ctx.db
        .query("flux_chatChannels")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    const out: any[] = [];
    const memberships = await ctx.db
      .query("flux_channelMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const membershipMap = new Map(memberships.map((m: any) => [m.channelId, m]));
    for (const c of channels) {
      if (c.archived && !permissions.has("channels:manage")) continue;
      if (c.visibility === "private" && !permissions.has("channels:manage") && !membershipMap.has(c._id)) {
        continue;
      }
      const lastMessage = await ctx.db
        .query("flux_chatMessages")
        .withIndex("by_channel", (q: any) => q.eq("channelId", c._id))
        .order("desc")
        .take(1);
      const last = lastMessage[0];
      const author = last ? await ctx.db.get(last.userId) : null;
      const member = membershipMap.get(c._id);
      const canManage = permissions.has("channels:manage") || member?.role === "moderator";
      const canPost = await canPostInChannel(ctx, c, userId, permissions);
      out.push({
        ...c,
        membership: member ? { role: member.role } : null,
        canManage,
        canPost,
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
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, userId);
    const ok = await canViewChannel(ctx, c, userId, permissions);
    if (!ok) return null;
    const member = await getChannelMembership(ctx, c._id, userId);
    const canManage = permissions.has("channels:manage") || member?.role === "moderator";
    const canPost = await canPostInChannel(ctx, c, userId, permissions);
    return { ...c, membership: member ? { role: member.role } : null, canManage, canPost };
  },
});

export const updateChannel = mutation({
  args: {
    channelId: v.id("flux_chatChannels"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    postPermission: v.optional(v.union(v.literal("all"), v.literal("admin"), v.literal("moderator"))),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, userId);
    const ok = await canManageChannel(ctx, c, userId, permissions);
    if (!ok) throw new Error("Forbidden");
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.visibility !== undefined) patch.visibility = args.visibility;
    if (args.postPermission !== undefined) patch.postPermission = args.postPermission;
    if (args.archived !== undefined) patch.archived = args.archived;
    await ctx.db.patch(args.channelId, patch);
    return true;
  },
});

export const deleteChannel = mutation({
  args: { channelId: v.id("flux_chatChannels") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    await assertWorkspaceAdmin(ctx, c.workspaceId);
    await ctx.db.patch(args.channelId, { archived: true, updatedAt: Date.now() });
    return true;
  },
});

export const listChannelMembers = query({
  args: { channelId: v.id("flux_chatChannels") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) return [];
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, userId);
    const ok = await canViewChannel(ctx, c, userId, permissions);
    if (!ok) return [];
    const rows = await ctx.db
      .query("flux_channelMembers")
      .withIndex("by_channel", (q: any) => q.eq("channelId", args.channelId))
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      if (u) {
        out.push({
          ...r,
          name: u.name ?? u.email,
          email: u.email,
          image: u.image,
        });
      }
    }
    return out;
  },
});

export const addChannelMember = mutation({
  args: {
    channelId: v.id("flux_chatChannels"),
    userId: v.id("users"),
    role: v.optional(v.union(v.literal("viewer"), v.literal("poster"), v.literal("moderator"))),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    const { userId: actorId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, actorId);
    const ok = await canManageChannel(ctx, c, actorId, permissions);
    if (!ok) throw new Error("Forbidden");
    const targetRole = args.role ?? "poster";
    await addChannelMemberInternal(ctx, c, args.userId, targetRole, actorId);
    return true;
  },
});

export const removeChannelMember = mutation({
  args: {
    channelId: v.id("flux_chatChannels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    const { userId: actorId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, actorId);
    const ok = await canManageChannel(ctx, c, actorId, permissions);
    if (!ok) throw new Error("Forbidden");
    // Prevent removing the creator/moderator if no other moderator exists.
    const existing = await getChannelMembership(ctx, c._id, args.userId);
    if (!existing) throw new Error("Member not found");
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const updateChannelMemberRole = mutation({
  args: {
    channelId: v.id("flux_chatChannels"),
    userId: v.id("users"),
    role: v.union(v.literal("viewer"), v.literal("poster"), v.literal("moderator")),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.channelId);
    if (!c) throw new Error("Channel not found");
    const { userId: actorId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, actorId);
    const ok = await canManageChannel(ctx, c, actorId, permissions);
    if (!ok) throw new Error("Forbidden");
    const existing = await getChannelMembership(ctx, c._id, args.userId);
    if (!existing) throw new Error("Member not found");
    await ctx.db.patch(existing._id, { role: args.role, updatedAt: Date.now() });
    return true;
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
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, userId);
    const ok = await canViewChannel(ctx, c, userId, permissions);
    if (!ok) return [];
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
          storageId: v.optional(v.id("_storage")),
          coreFileId: v.optional(v.string()),
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
    const permissions = await getChannelPermissions(ctx, c.workspaceId, userId);
    const ok = await canPostInChannel(ctx, c, userId, permissions);
    if (!ok) throw new Error("You do not have permission to post in this channel");
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
    const { userId } = await assertWorkspaceMember(ctx, m.workspaceId, "member");
    const permissions = await getChannelPermissions(ctx, m.workspaceId, userId);
    if (String(m.userId) !== String(userId) && !permissions.has("channels:manage")) {
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
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId);
    const permissions = await getChannelPermissions(ctx, c.workspaceId, userId);
    const ok = await canViewChannel(ctx, c, userId, permissions);
    if (!ok) throw new Error("Forbidden");
    const now = Date.now();
    await markReadInternal(ctx, userId, args.channelId, now);
    return true;
  },
});

async function getUnreadCounts(ctx: any, workspaceId: string, userId: string) {
  const permissions = await getChannelPermissions(ctx, workspaceId, userId);
  const channels = await ctx.db
    .query("flux_chatChannels")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
    .collect();
  const reads = await ctx.db
    .query("flux_chatUserReads")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const memberships = await ctx.db
    .query("flux_channelMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const membershipMap = new Map(memberships.map((m: any) => [m.channelId, m]));
  const readMap = new Map(reads.map((r: any) => [r.channelId, r.lastReadAt]));
  const out: { channelId: string; count: number }[] = [];
  for (const c of channels) {
    if (c.archived && !permissions.has("channels:manage")) continue;
    if (c.visibility === "private" && !permissions.has("channels:manage") && !membershipMap.has(c._id)) {
      continue;
    }
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

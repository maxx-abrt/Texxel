import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const requireAuth = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
};

export const getMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    // Get owned workspaces
    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // Get workspaces where user is a member
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const memberWorkspaceIds = memberships
      .map((m) => m.workspaceId)
      .filter((id) => !owned.some((w) => w._id === id));

    const memberWorkspaces = await Promise.all(
      memberWorkspaceIds.map((id) => ctx.db.get(id)),
    );

    return [...owned, ...memberWorkspaces.filter(Boolean)];
  },
});

export const getOrCreatePersonal = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    // Check for existing personal workspace
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    const personal = existing.find((w) => w.isPersonal);
    if (personal) return personal._id;

    // Create personal workspace
    const wsId = await ctx.db.insert("workspaces", {
      name: "Personal",
      ownerId: userId,
      isPersonal: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId: wsId,
      userId,
      userEmail: identity.email ?? "",
      userName: identity.name ?? "",
      userImage: (identity as any).pictureUrl ?? undefined,
      role: "owner",
      joinedAt: Date.now(),
    });

    return wsId;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    // Check max 5 owned workspaces
    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    if (owned.length >= 5) {
      throw new Error("Maximum 5 workspaces per user");
    }

    const wsId = await ctx.db.insert("workspaces", {
      name: args.name.trim(),
      icon: args.icon,
      color: args.color,
      ownerId: userId,
      isPersonal: false,
      createdAt: Date.now(),
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId: wsId,
      userId,
      userEmail: identity.email ?? "",
      userName: identity.name ?? "",
      userImage: (identity as any).pictureUrl ?? undefined,
      role: "owner",
      joinedAt: Date.now(),
    });

    return wsId;
  },
});

export const update = mutation({
  args: {
    id: v.id("workspaces"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    extensions: v.optional(v.string()),
    uiConfig: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const ws = await ctx.db.get(args.id);
    if (!ws || ws.ownerId !== userId) throw new Error("Not authorized");
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const ws = await ctx.db.get(args.id);
    if (!ws || ws.ownerId !== userId) throw new Error("Not authorized");
    if (ws.isPersonal) throw new Error("Cannot delete personal workspace");

    // Delete all workspace members
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);

    await ctx.db.delete(args.id);
  },
});

export const getMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const addMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userEmail: v.string(),
    userName: v.string(),
    userId: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    // Check caller is owner or admin
    const callerMember = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId),
      )
      .first();
    if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
      throw new Error("Not authorized");
    }

    // Check not already member
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .first();
    if (existing) throw new Error("Already a member");

    return ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      userEmail: args.userEmail,
      userName: args.userName,
      role: args.role ?? "member",
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.ownerId !== userId) throw new Error("Not authorized");

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.targetUserId),
      )
      .first();
    if (member) await ctx.db.delete(member._id);
  },
});

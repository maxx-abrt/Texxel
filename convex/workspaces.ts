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

    // Check subscription tier for workspace limit
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const isActiveSuite =
      sub?.plan === "suite" &&
      sub.status === "active" &&
      (!sub.currentPeriodEnd || sub.currentPeriodEnd > Date.now());

    const maxWorkspaces = isActiveSuite ? Infinity : 5;

    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    if (owned.length >= maxWorkspaces) {
      throw new Error(isActiveSuite ? "workspace_limit" : "workspace_limit_free");
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
    role: v.optional(v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer"))),
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
      role: args.role ?? "editor",
      joinedAt: Date.now(),
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.string(),
    newRole: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

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

    const target = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.targetUserId),
      )
      .first();
    if (!target) throw new Error("Member not found");
    if (target.role === "owner") throw new Error("Cannot change owner role");

    await ctx.db.patch(target._id, { role: args.newRole });
    return true;
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

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.targetUserId),
      )
      .first();
    if (!member) return;
    if (member.role === "owner") throw new Error("Cannot remove owner");
    await ctx.db.delete(member._id);
  },
});

export const getMyRole = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId),
      )
      .first();
    return member?.role ?? null;
  },
});

// ─── Workspace Invitations (Notion-like) ────────────────────────────────────

export const inviteMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer"))),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    // Check caller is owner or admin
    const callerMember = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId),
      )
      .first();
    if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
      throw new Error("Not authorized to invite");
    }

    // Check if already invited (pending)
    const existingInvite = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace_email", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("invitedEmail", args.email),
      )
      .first();
    if (existingInvite && existingInvite.status === "pending") {
      throw new Error("Already invited");
    }

    // Check if already a member
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (members.some((m) => m.userEmail === args.email)) {
      throw new Error("Already a member");
    }

    const token = `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return ctx.db.insert("workspaceInvitations", {
      workspaceId: args.workspaceId,
      invitedEmail: args.email,
      invitedBy: userId,
      invitedByName: identity.name ?? undefined,
      role: args.role ?? "editor",
      status: "pending",
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      createdAt: Date.now(),
    });
  },
});

export const getWorkspaceInvitations = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const getMyInvitations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return [];
    const invites = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_email", (q) => q.eq("invitedEmail", identity.email!))
      .collect();
    // Only show pending, non-expired
    const now = Date.now();
    const pending = invites.filter((i) => i.status === "pending" && i.expiresAt > now);
    // Enrich with workspace name
    const enriched = await Promise.all(
      pending.map(async (inv) => {
        const ws = await ctx.db.get(inv.workspaceId);
        return { ...inv, workspaceName: ws?.name ?? "Unknown" };
      }),
    );
    return enriched;
  },
});

export const acceptInvitation = mutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation already processed");
    if (inv.expiresAt < Date.now()) throw new Error("Invitation expired");
    if (inv.invitedEmail !== identity.email) throw new Error("This invitation is not for you");

    // Add as workspace member
    await ctx.db.insert("workspaceMembers", {
      workspaceId: inv.workspaceId,
      userId,
      userEmail: identity.email ?? "",
      userName: identity.name ?? "",
      userImage: (identity as any).pictureUrl ?? undefined,
      role: inv.role,
      joinedAt: Date.now(),
    });

    // Mark invitation as accepted
    await ctx.db.patch(args.invitationId, { status: "accepted" });
    return inv.workspaceId;
  },
});

export const rejectInvitation = mutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found");
    if (inv.invitedEmail !== identity.email) throw new Error("Not your invitation");
    await ctx.db.patch(args.invitationId, { status: "rejected" });
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found");

    // Check caller is owner or admin of the workspace
    const callerMember = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", inv.workspaceId).eq("userId", userId),
      )
      .first();
    if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.invitationId);
  },
});

export const leaveWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId),
      )
      .first();
    if (!member) throw new Error("Not a member");
    if (member.role === "owner") throw new Error("Owner cannot leave — transfer ownership or delete workspace");
    await ctx.db.delete(member._id);
  },
});

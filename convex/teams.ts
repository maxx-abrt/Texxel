import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const requireAuth = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
};

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    ownerImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("Slug already taken");

    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      icon: args.icon,
      ownerId: userId,
      createdAt: Date.now(),
    });

    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      userEmail: args.ownerEmail ?? "",
      userName: args.ownerName ?? "",
      userImage: args.ownerImage,
      role: "owner",
      joinedAt: Date.now(),
    });

    return teamId;
  },
});

export const update = mutation({
  args: {
    id: v.id("teams"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    iconGradientFrom: v.optional(v.string()),
    iconGradientTo: v.optional(v.string()),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const team = await ctx.db.get(args.id);
    if (!team) throw new Error("Team not found");

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.id).eq("userId", userId))
      .first();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Not authorized");

    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const team = await ctx.db.get(args.id);
    if (!team) throw new Error("Team not found");
    if (team.ownerId !== userId) throw new Error("Only owner can delete team");

    const members = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", args.id)).collect();
    for (const m of members) await ctx.db.delete(m._id);

    const invitations = await ctx.db.query("teamInvitations").withIndex("by_team", (q) => q.eq("teamId", args.id)).collect();
    for (const inv of invitations) await ctx.db.delete(inv._id);

    await ctx.db.delete(args.id);
  },
});

export const getMyTeams = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const teams = await Promise.all(
      memberships.map(async (m) => {
        const team = await ctx.db.get(m.teamId);
        return team ? { ...team, role: m.role } : null;
      }),
    );
    return teams.filter(Boolean);
  },
});

export const getById = query({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const team = await ctx.db.get(args.id);
    if (!team) throw new Error("Team not found");

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.id).eq("userId", userId))
      .first();
    if (!member) throw new Error("Not a member of this team");

    return { ...team, role: member.role };
  },
});

export const getMembers = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const isMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", userId))
      .first();
    if (!isMember) throw new Error("Not a member");

    return ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", args.teamId)).collect();
  },
});

export const inviteMember = mutation({
  args: {
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", userId))
      .first();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("teamInvitations")
      .withIndex("by_team_email", (q) => q.eq("teamId", args.teamId).eq("invitedEmail", args.email))
      .first();
    if (existing && existing.status === "pending") throw new Error("Invitation already sent");

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const invId = await ctx.db.insert("teamInvitations", {
      teamId: args.teamId,
      invitedEmail: args.email,
      invitedBy: userId,
      role: args.role,
      status: "pending",
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    return invId;
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string(), userId: v.string(), userEmail: v.string(), userName: v.string(), userImage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const invitation = await ctx.db
      .query("teamInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") throw new Error("Invitation already used");
    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Invitation expired");
    }

    const existingMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", invitation.teamId).eq("userId", args.userId))
      .first();
    if (existingMember) throw new Error("Already a member");

    await ctx.db.insert("teamMembers", {
      teamId: invitation.teamId,
      userId: args.userId,
      userEmail: args.userEmail,
      userName: args.userName,
      userImage: args.userImage,
      role: invitation.role,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(invitation._id, { status: "accepted" });
    return invitation.teamId;
  },
});

export const removeMember = mutation({
  args: { teamId: v.id("teams"), targetUserId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const actorMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", userId))
      .first();
    if (!actorMember || !["owner", "admin"].includes(actorMember.role)) throw new Error("Not authorized");

    if (args.targetUserId === team.ownerId) throw new Error("Cannot remove owner");

    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", args.targetUserId))
      .first();
    if (!targetMember) throw new Error("Member not found");
    await ctx.db.delete(targetMember._id);
  },
});

export const updateMemberRole = mutation({
  args: { teamId: v.id("teams"), targetUserId: v.string(), role: v.union(v.literal("admin"), v.literal("member")) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");
    if (team.ownerId !== userId) throw new Error("Only owner can change roles");

    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", args.targetUserId))
      .first();
    if (!targetMember) throw new Error("Member not found");
    await ctx.db.patch(targetMember._id, { role: args.role });
  },
});

export const getPendingInvitations = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return ctx.db
      .query("teamInvitations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query("teamInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!inv) return null;
    const team = await ctx.db.get(inv.teamId);
    return { ...inv, teamName: team?.name ?? "Unknown Team" };
  },
});

export const cancelInvitation = mutation({
  args: { invitationId: v.id("teamInvitations") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Not found");

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", inv.teamId).eq("userId", userId))
      .first();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Not authorized");
    await ctx.db.patch(args.invitationId, { status: "rejected" });
  },
});

export const searchMembers = query({
  args: { teamId: v.id("teams"), query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const isMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId).eq("userId", userId))
      .first();
    if (!isMember) return [];

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    if (!args.query) return members;
    const q = args.query.toLowerCase();
    return members.filter(
      (m) => m.userName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q),
    );
  },
});

export const getAllMyTeamMembers = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const allMembers: any[] = [];
    const seen = new Set<string>();

    for (const m of memberships) {
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", m.teamId))
        .collect();
      const team = await ctx.db.get(m.teamId);
      for (const tm of teamMembers) {
        if (!seen.has(tm.userId)) {
          seen.add(tm.userId);
          allMembers.push({ ...tm, teamName: team?.name });
        }
      }
    }
    return allMembers;
  },
});

export const getMyPendingInvitations = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const email = identity.email;
    if (!email) return [];

    const invitations = await ctx.db
      .query("teamInvitations")
      .withIndex("by_email", (q) => q.eq("invitedEmail", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const results = [];
    for (const inv of invitations) {
      const team = await ctx.db.get(inv.teamId);
      results.push({ ...inv, teamName: team?.name ?? "Unknown" });
    }
    return results;
  },
});

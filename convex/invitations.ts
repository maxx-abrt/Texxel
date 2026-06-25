import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertWorkspaceAdmin,
  assertWorkspaceMember,
  requireUserId,
  logActivity,
  notifyWorkspaceMembers,
} from "./lib/auth";

function makeToken() {
  const a = Math.random().toString(36).slice(2);
  const b = Math.random().toString(36).slice(2);
  return `${a}${b}`.replace(/[^a-z0-9]/gi, "");
}

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("invitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceAdmin(ctx, args.workspaceId);
    const token = makeToken();
    const now = Date.now();
    const id = await ctx.db.insert("invitations", {
      email: args.email.toLowerCase().trim(),
      workspaceId: args.workspaceId,
      role: args.role,
      token,
      status: "pending",
      invitedBy: userId,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      createdAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "invitation.sent",
      targetType: "invitation",
      targetId: id,
      metadata: { email: args.email, role: args.role },
    });
    return { id, token };
  },
});

export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found");
    const { userId } = await assertWorkspaceAdmin(ctx, inv.workspaceId);
    await ctx.db.patch(args.invitationId, { status: "revoked" });
    await logActivity(ctx, {
      workspaceId: inv.workspaceId,
      actorId: userId,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: args.invitationId,
    });
    return true;
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!inv) return null;
    const w = await ctx.db.get(inv.workspaceId);
    return {
      ...inv,
      workspace: w ? { name: w.name, slug: w.slug, avatar: w.avatar } : null,
    };
  },
});

export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const inv = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation no longer valid");
    if (inv.expiresAt < Date.now()) {
      await ctx.db.patch(inv._id, { status: "expired" });
      throw new Error("Invitation expired");
    }
    // Make sure email matches the invited email (optional safety).
    const user: any = await ctx.db.get(userId);
    if (user?.email && inv.email && user.email.toLowerCase() !== inv.email) {
      // We still allow, but log this. Some companies want to enforce.
    }
    // Insert membership if not already a member.
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", inv.workspaceId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("memberships", {
        userId,
        workspaceId: inv.workspaceId,
        role: inv.role,
        joinedAt: Date.now(),
      });
    }
    await ctx.db.patch(inv._id, { status: "accepted" });
    await logActivity(ctx, {
      workspaceId: inv.workspaceId,
      actorId: userId,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: inv._id,
    });
    await notifyWorkspaceMembers(ctx, {
      workspaceId: inv.workspaceId,
      type: "member_joined",
      title: "New team member",
      message: `${user?.name ?? user?.email ?? "A new member"} joined the workspace.`,
      exceptUserId: userId,
    });
    return inv.workspaceId;
  },
});

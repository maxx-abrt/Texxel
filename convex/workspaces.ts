import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  assertWorkspaceAdmin,
  assertWorkspaceMember,
  generateSlug,
  getOptionalUserId,
  logActivity,
  notifyWorkspaceMembers,
  requireUserId,
} from "./lib/auth";
import { ensureChannel } from "./flux_chat";

/** List workspaces the current user is a member of. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [] as Array<{
      _id: Id<"workspaces">;
      name: string;
      slug: string;
      avatar?: string;
      description?: string;
      role: string;
      storageQuota: number;
      locale?: string;
      currency?: string;
      type?: string;
      ownerId: Id<"users">;
      memberCount: number;
    }>;
    for (const m of memberships) {
      const w = await ctx.db.get(m.workspaceId);
      if (!w) continue;
      const memberCount = (
        await ctx.db
          .query("memberships")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", w._id))
          .collect()
      ).length;
      out.push({
        _id: w._id,
        name: w.name,
        slug: w.slug,
        avatar: w.avatar,
        description: w.description,
        role: m.role,
        storageQuota: w.storageQuota,
        locale: w.locale,
        currency: w.currency,
        type: w.type,
        ownerId: w.ownerId,
        memberCount,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const w = await ctx.db.get(args.workspaceId);
    if (!w) return null;
    return w;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("individual"),
        v.literal("business"),
        v.literal("association"),
      ),
    ),
    currency: v.optional(v.string()),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const slug = generateSlug(args.name);
    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      slug,
      description: args.description,
      storageQuota: 524_288_000, // 500MB default
      ownerId: userId,
      currency: args.currency ?? "EUR",
      locale: args.locale ?? "en",
      type: args.type ?? "individual",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memberships", {
      userId,
      workspaceId,
      role: "owner",
      joinedAt: now,
    });
    await ensureChannel(ctx, workspaceId as any, "general", "workspace", userId as any);
    await logActivity(ctx, {
      workspaceId,
      actorId: userId,
      action: "workspace.created",
      targetType: "workspace",
      targetId: workspaceId,
      metadata: { name: args.name },
    });
    return workspaceId;
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    currency: v.optional(v.string()),
    locale: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("individual"),
        v.literal("business"),
        v.literal("association"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceAdmin(ctx, args.workspaceId);
    const patch: any = { updatedAt: Date.now() };
    for (const k of [
      "name",
      "description",
      "avatar",
      "currency",
      "locale",
      "type",
    ] as const) {
      if ((args as any)[k] !== undefined) patch[k] = (args as any)[k];
    }
    await ctx.db.patch(args.workspaceId, patch);
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "workspace.updated",
      targetType: "workspace",
      targetId: args.workspaceId,
      metadata: patch,
    });
    return args.workspaceId;
  },
});

export const remove = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const w = await ctx.db.get(args.workspaceId);
    if (!w) throw new Error("Workspace not found");
    if (w.ownerId !== userId) {
      throw new Error("Forbidden: only the owner can delete a workspace");
    }
    // Cleanup: memberships, invitations, projects, tasks, activities, a2e_* per workspace
    const tables = [
      "memberships",
      "invitations",
      "projects",
      "tasks",
      "activities",
      "notifications",
      "a2e_invoices",
      "a2e_expenses",
      "a2e_documents",
      "a2e_bookSheets",
      "a2e_bookEntries",
      "a2e_categories",
      "a2e_fiches",
    ] as const;
    for (const t of tables) {
      const rows = await ctx.db
        .query(t as any)
        .withIndex("by_workspace" as any, (q: any) =>
          q.eq("workspaceId", args.workspaceId),
        )
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.workspaceId);
    return true;
  },
});

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const out: Array<{
      _id: Id<"memberships">;
      userId: Id<"users">;
      role: string;
      joinedAt: number;
      name: string | null;
      email: string | null;
      image: string | null;
    }> = [];
    for (const m of memberships) {
      const u: any = await ctx.db.get(m.userId);
      out.push({
        _id: m._id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: u?.name ?? null,
        email: u?.email ?? null,
        image: u?.image ?? null,
      });
    }
    return out;
  },
});

export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    memberId: v.id("memberships"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceAdmin(ctx, args.workspaceId);
    const m = await ctx.db.get(args.memberId);
    if (!m || m.workspaceId !== args.workspaceId) {
      throw new Error("Member not found");
    }
    if (m.role === "owner") throw new Error("Cannot change owner role");
    await ctx.db.patch(args.memberId, { role: args.role });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "member.role_updated",
      targetType: "membership",
      targetId: args.memberId,
      metadata: { role: args.role, userId: m.userId },
    });
    return true;
  },
});

export const removeMember = mutation({
  args: { workspaceId: v.id("workspaces"), memberId: v.id("memberships") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceAdmin(ctx, args.workspaceId);
    const m = await ctx.db.get(args.memberId);
    if (!m || m.workspaceId !== args.workspaceId) {
      throw new Error("Member not found");
    }
    if (m.role === "owner") throw new Error("Cannot remove the owner");
    await ctx.db.delete(args.memberId);
    await ctx.db.insert("notifications", {
      userId: m.userId,
      workspaceId: args.workspaceId,
      type: "member_left",
      title: "Removed from workspace",
      message: "You were removed from a workspace.",
      read: false,
      createdAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "member.removed",
      targetType: "membership",
      targetId: args.memberId,
      metadata: { userId: m.userId },
    });
    return true;
  },
});

export const leave = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!m) throw new Error("Not a member");
    if (m.role === "owner") {
      throw new Error("Owner cannot leave. Transfer ownership first.");
    }
    await ctx.db.delete(m._id);
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "member.left",
      targetType: "membership",
      targetId: m._id,
    });
    return true;
  },
});

/** Storage usage rollup for the workspace (bytes used vs quota). */
export const getStorage = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const w = await ctx.db.get(args.workspaceId);
    if (!w) return null;
    const docs = await ctx.db
      .query("a2e_documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const used = docs.reduce((acc, d) => acc + (d.size || 0), 0);
    return {
      used,
      total: w.storageQuota,
      count: docs.length,
      available: Math.max(0, w.storageQuota - used),
      percentage: w.storageQuota > 0 ? (used / w.storageQuota) * 100 : 0,
    };
  },
});

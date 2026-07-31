import { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { Id } from "../_generated/dataModel";
import { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export type QCtx = GenericQueryCtx<DataModel>;
export type MCtx = GenericMutationCtx<DataModel>;

export type Role = "owner" | "admin" | "member" | "viewer";
const ROLE_RANK: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export async function requireUserId(ctx: QCtx | MCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
    .unique();
  if (!user) throw new Error("User not found — call users.store after login");
  return user._id;
}

export async function getOptionalUserId(
  ctx: QCtx | MCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
    .unique();
  return user?._id ?? null;
}

export async function assertWorkspaceMember(
  ctx: QCtx | MCtx,
  workspaceId: Id<"workspaces">,
  minRole: Role = "viewer",
): Promise<{ userId: Id<"users">; role: Role }> {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!membership) {
    throw new Error("Forbidden: you are not a member of this workspace");
  }
  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new Error(`Forbidden: requires ${minRole} or higher`);
  }
  return { userId, role: membership.role };
}

export async function assertWorkspaceAdmin(
  ctx: QCtx | MCtx,
  workspaceId: Id<"workspaces">,
) {
  return assertWorkspaceMember(ctx, workspaceId, "admin");
}

export async function logActivity(
  ctx: MCtx,
  args: {
    workspaceId: Id<"workspaces">;
    actorId: Id<"users">;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: any;
  },
) {
  await ctx.db.insert("activities", {
    workspaceId: args.workspaceId,
    actorId: args.actorId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}

export async function notifyWorkspaceMembers(
  ctx: MCtx,
  args: {
    workspaceId: Id<"workspaces">;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: any;
    exceptUserId?: Id<"users">;
  },
) {
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();
  for (const m of members) {
    if (args.exceptUserId && m.userId === args.exceptUserId) continue;
    await ctx.db.insert("notifications", {
      userId: m.userId,
      workspaceId: args.workspaceId,
      type: args.type,
      title: args.title,
      message: args.message,
      read: false,
      link: args.link,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  }

  // Dual-write to A2E Core via the service bridge (best-effort, scheduled as
  // an action since mutation context can't use HTTP clients). Only fires when
  // the workspace is linked to core (has a coreId).
  const workspace = await ctx.db.get(args.workspaceId);
  if (workspace?.coreId) {
    await ctx.scheduler.runAfter(0, internal.coreSync.notifyCore, {
      coreWorkspaceId: workspace.coreId,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
    });
  }
}

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "workspace"}-${suffix}`;
}

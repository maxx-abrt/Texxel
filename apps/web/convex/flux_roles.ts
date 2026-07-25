import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, requireUserId } from "./lib/auth";

export const PERMISSIONS = [
  "workspace:manage",
  "members:manage",
  "roles:manage",
  "invites:manage",
  "projects:manage",
  "projects:view",
  "projects:assign",
  "tasks:manage",
  "tasks:assign",
  "tasks:view",
  "channels:manage",
  "channels:post",
  "channels:mention_all",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const BASE_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: PERMISSIONS.slice(),
  admin: [
    "workspace:manage",
    "members:manage",
    "roles:manage",
    "invites:manage",
    "projects:manage",
    "projects:view",
    "projects:assign",
    "tasks:manage",
    "tasks:assign",
    "tasks:view",
    "channels:manage",
    "channels:post",
    "channels:mention_all",
  ],
  member: [
    "projects:view",
    "projects:assign",
    "tasks:manage",
    "tasks:assign",
    "tasks:view",
    "channels:post",
    "channels:mention_all",
  ],
  viewer: ["projects:view", "tasks:view"],
};

export async function getUserPermissions(
  ctx: any,
  workspaceId: string,
  userId: string,
): Promise<Set<Permission>> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_workspace", (q: any) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
  const baseRole = membership?.role ?? "viewer";
  const permissions = new Set<Permission>(BASE_ROLE_PERMISSIONS[baseRole] ?? []);

  const assignments = await ctx.db
    .query("flux_roleAssignments")
    .withIndex("by_user_workspace", (q: any) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .collect();
  for (const a of assignments) {
    const role = await ctx.db.get(a.roleId);
    if (role) {
      for (const p of role.permissions) {
        if (PERMISSIONS.includes(p as Permission)) {
          permissions.add(p as Permission);
        }
      }
    }
  }
  return permissions;
}

export async function hasPermission(
  ctx: any,
  workspaceId: string,
  userId: string,
  permission: Permission,
): Promise<boolean> {
  const permissions = await getUserPermissions(ctx, workspaceId, userId);
  return permissions.has(permission);
}

export async function assertPermission(
  ctx: any,
  workspaceId: string,
  permission: Permission,
) {
  const userId = await requireUserId(ctx);
  const ok = await hasPermission(ctx, workspaceId, userId, permission);
  if (!ok) throw new Error(`Forbidden: requires ${permission}`);
  return { userId };
}

export async function seedDefaultRoles(ctx: any, workspaceId: string, createdBy: string) {
  const now = Date.now();
  const defaults = [
    { name: "Admin", color: "#2f7ea6", permissions: BASE_ROLE_PERMISSIONS.admin, isDefault: true, order: 0 },
    { name: "Member", color: "#2fbf9b", permissions: BASE_ROLE_PERMISSIONS.member, isDefault: true, order: 1 },
    { name: "Viewer", color: "var(--muted-foreground)", permissions: BASE_ROLE_PERMISSIONS.viewer, isDefault: true, order: 2 },
  ];
  for (const d of defaults) {
    await ctx.db.insert("flux_roles", {
      workspaceId,
      name: d.name,
      color: d.color,
      permissions: d.permissions,
      isDefault: true,
      order: d.order,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const listRoles = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const roles = await ctx.db
      .query("flux_roles")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return roles.sort((a: any, b: any) => a.order - b.order);
  },
});

export const createRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertPermission(ctx, args.workspaceId, "roles:manage");
    const now = Date.now();
    const count = (
      await ctx.db
        .query("flux_roles")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .collect()
    ).length;
    return await ctx.db.insert("flux_roles", {
      workspaceId: args.workspaceId,
      name: args.name,
      color: args.color,
      permissions: args.permissions,
      isDefault: false,
      order: count,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRole = mutation({
  args: {
    roleId: v.id("flux_roles"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    await assertPermission(ctx, role.workspaceId, "roles:manage");
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.color !== undefined) patch.color = args.color;
    if (args.permissions !== undefined) patch.permissions = args.permissions;
    if (args.order !== undefined) patch.order = args.order;
    await ctx.db.patch(args.roleId, patch);
    return true;
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("flux_roles") },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    await assertPermission(ctx, role.workspaceId, "roles:manage");
    if (role.isDefault) throw new Error("Cannot delete a default role");
    // Remove all assignments for this role.
    const assignments = await ctx.db
      .query("flux_roleAssignments")
      .withIndex("by_role", (q: any) => q.eq("roleId", args.roleId))
      .collect();
    for (const a of assignments) {
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(args.roleId);
    return true;
  },
});

export const listRoleAssignments = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("flux_roleAssignments")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows;
  },
});

export const listMyRoles = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("flux_roleAssignments")
      .withIndex("by_user_workspace", (q: any) =>
        q.eq("userId", userId).eq("workspaceId", args.workspaceId),
      )
      .collect();
    const out: any[] = [];
    for (const r of rows) {
      const role = await ctx.db.get(r.roleId);
      if (role) out.push({ ...r, role });
    }
    return out;
  },
});

export const assignRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    roleId: v.id("flux_roles"),
  },
  handler: async (ctx, args) => {
    const { userId: actorId } = await assertPermission(ctx, args.workspaceId, "members:manage");
    const existing = await ctx.db
      .query("flux_roleAssignments")
      .withIndex("by_user_workspace", (q: any) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .collect();
    const already = existing.find((a: any) => a.roleId === args.roleId);
    if (already) return already._id;
    return await ctx.db.insert("flux_roleAssignments", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      roleId: args.roleId,
      assignedBy: actorId,
      assignedAt: Date.now(),
    });
  },
});

export const removeRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    roleId: v.id("flux_roles"),
  },
  handler: async (ctx, args) => {
    await assertPermission(ctx, args.workspaceId, "members:manage");
    const existing = await ctx.db
      .query("flux_roleAssignments")
      .withIndex("by_user_workspace", (q: any) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .collect();
    const match = existing.find((a: any) => a.roleId === args.roleId);
    if (match) await ctx.db.delete(match._id);
    return true;
  },
});

export const setMemberRoles = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    roleIds: v.array(v.id("flux_roles")),
  },
  handler: async (ctx, args) => {
    const { userId: actorId } = await assertPermission(ctx, args.workspaceId, "members:manage");
    const existing = await ctx.db
      .query("flux_roleAssignments")
      .withIndex("by_user_workspace", (q: any) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .collect();
    const currentIds = new Set(existing.map((a: any) => a.roleId));
    const targetIds = new Set(args.roleIds);
    for (const roleId of targetIds) {
      if (!currentIds.has(roleId)) {
        await ctx.db.insert("flux_roleAssignments", {
          workspaceId: args.workspaceId,
          userId: args.userId,
          roleId,
          assignedBy: actorId,
          assignedAt: Date.now(),
        });
      }
    }
    for (const a of existing) {
      if (!targetIds.has(a.roleId)) {
        await ctx.db.delete(a._id);
      }
    }
    return true;
  },
});

export const myPermissions = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const perms = await getUserPermissions(ctx, args.workspaceId, userId);
    return Array.from(perms);
  },
});

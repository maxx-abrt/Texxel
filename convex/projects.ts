import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const requireAuth = async (ctx: any) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
};

const canAccessProject = async (ctx: any, projectId: any, userId: string) => {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  if (project.ownerId === userId) return { project, role: "owner" as const };

  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q: any) => q.eq("projectId", projectId).eq("userId", userId))
    .first();
  if (!member) {
    if (project.teamId) {
      const teamMember = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_user", (q: any) => q.eq("teamId", project.teamId).eq("userId", userId))
        .first();
      if (teamMember) return { project, role: teamMember.role as string };
    }
    throw new Error("Not authorized");
  }
  return { project, role: member.role };
};

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    dueDate: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (args.teamId) {
      const member = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_user", (q) => q.eq("teamId", args.teamId!).eq("userId", userId))
        .first();
      if (!member) throw new Error("Not a team member");
    }

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      icon: args.icon,
      color: args.color ?? "#6366f1",
      status: "active",
      teamId: args.teamId,
      ownerId: userId,
      workspaceId: args.workspaceId,
      createdAt: Date.now(),
      dueDate: args.dueDate,
    });

    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role: "owner",
    });

    return projectId;
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"), v.literal("completed"))),
    dueDate: v.optional(v.number()),
    teamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const { project, role } = await canAccessProject(ctx, args.id, userId);
    if (!["owner", "admin", "editor"].includes(role)) throw new Error("Not authorized");
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Not found");
    if (project.ownerId !== userId) throw new Error("Only owner can delete");

    const members = await ctx.db.query("projectMembers").withIndex("by_project", (q) => q.eq("projectId", args.id)).collect();
    for (const m of members) await ctx.db.delete(m._id);

    const tasks = await ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", args.id)).collect();
    for (const t of tasks) await ctx.db.delete(t._id);

    await ctx.db.delete(args.id);
  },
});

export const getMyProjects = query({
  args: {
    teamId: v.optional(v.id("teams")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    if (args.teamId) {
      return ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.neq(q.field("status"), "archived"))
        .collect();
    }

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = await Promise.all(memberships.map((m) => ctx.db.get(m.projectId)));
    const filtered = projects.filter((p) => p && p.status !== "archived" && !p.teamId) as any[];
    if (!args.workspaceId) return filtered;
    return filtered.filter((p) => p.workspaceId === args.workspaceId);
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const { project, role } = await canAccessProject(ctx, args.id, identity.subject);
    return { ...project, role };
  },
});

export const getMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await canAccessProject(ctx, args.projectId, identity.subject);
    return ctx.db.query("projectMembers").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect();
  },
});

export const addMember = mutation({
  args: { projectId: v.id("projects"), targetUserId: v.string(), role: v.union(v.literal("editor"), v.literal("viewer")) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const { role: actorRole } = await canAccessProject(ctx, args.projectId, userId);
    if (!["owner", "admin"].includes(actorRole)) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", args.targetUserId))
      .first();
    if (existing) throw new Error("Already a member");

    await ctx.db.insert("projectMembers", { projectId: args.projectId, userId: args.targetUserId, role: args.role });
  },
});

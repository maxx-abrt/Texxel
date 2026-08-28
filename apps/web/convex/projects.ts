import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";
import { ensureChannel } from "./flux_chat";
import { assertPermission, getUserPermissions } from "./flux_roles";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    const perms = await getUserPermissions(ctx, args.workspaceId, userId);
    const canViewAll = perms.has("projects:view");

    // Task progress per project.
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const statusRows = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const doneKeys = new Set(
      statusRows.length ? statusRows.filter((s) => s.isDone).map((s) => s.key) : ["done"],
    );
    // Assigned members per project.
    const memberRows = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const membershipByProject = new Map<string, string[]>();
    for (const m of memberRows) {
      const list = membershipByProject.get(m.projectId) ?? [];
      list.push(m.userId);
      membershipByProject.set(m.projectId, list);
    }

    return projects
      .filter((p) => {
        if (canViewAll) return true;
        const members = membershipByProject.get(p._id) ?? [];
        return members.includes(userId);
      })
      .map((p) => {
        const projTasks = allTasks.filter((t) => t.projectId === p._id);
        const taskTotal = projTasks.length;
        const taskDone = projTasks.filter((t) => doneKeys.has(t.status)).length;
        const memberCount = (membershipByProject.get(p._id) ?? []).length;
        const isMember = (membershipByProject.get(p._id) ?? []).includes(userId);
        return { ...p, taskTotal, taskDone, memberCount, isMember };
      });
  },
});

export const listMine = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId);
    const memberRows = await ctx.db
      .query("flux_projectMembers")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId),
      )
      .collect();
    const projectIds = new Set(memberRows.map((m) => m.projectId));
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return projects.filter((p) => projectIds.has(p._id));
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) return null;
    await assertWorkspaceMember(ctx, p.workspaceId);
    return p;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    client: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("on_hold"),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    targetDate: v.optional(v.number()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    key: v.optional(v.string()),
    autoCreateFiche: v.optional(v.boolean()),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertPermission(ctx, args.workspaceId, "projects:manage");
    const now = Date.now();
    // M0.3: default the identifier key from the project name (PRJ-42 prefix).
    const key =
      args.key ??
      ((args.name ?? "PRJ").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "PRJ");
    const id = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      name: args.name,
      client: args.client,
      status: args.status,
      startDate: args.startDate,
      endDate: args.endDate,
      targetDate: args.targetDate,
      description: args.description,
      color: args.color,
      key,
      nextTaskNumber: 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create project discussion channel
    await ensureChannel(
      ctx,
      args.workspaceId as any,
      `project-${args.name}`,
      "project",
      userId as any,
      id as any,
    );

    // Auto-create project sheet (fiche projet)
    if (args.autoCreateFiche) {
      await ctx.db.insert("a2e_fiches", {
        workspaceId: args.workspaceId,
        projectId: id,
        template: "blank",
        title: args.name,
        subtitle: args.description,
        data: {},
        status: "draft",
        locale: args.locale,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "project.created",
      targetType: "project",
      targetId: id,
      metadata: { name: args.name },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    client: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("planning"),
        v.literal("active"),
        v.literal("completed"),
        v.literal("on_hold"),
      ),
    ),
    startDate: v.optional(v.union(v.number(), v.null())),
    endDate: v.optional(v.union(v.number(), v.null())),
    targetDate: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    const { userId } = await assertPermission(ctx, p.workspaceId, "projects:manage");
    const { projectId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v === null ? undefined : v;
    }
    await ctx.db.patch(args.projectId, patch);
    await logActivity(ctx, {
      workspaceId: p.workspaceId,
      actorId: userId,
      action: "project.updated",
      targetType: "project",
      targetId: args.projectId,
    });
    return args.projectId;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    const { userId } = await assertPermission(ctx, p.workspaceId, "projects:manage");
    await ctx.db.delete(args.projectId);
    await logActivity(ctx, {
      workspaceId: p.workspaceId,
      actorId: userId,
      action: "project.deleted",
      targetType: "project",
      targetId: args.projectId,
    });
    return true;
  },
});


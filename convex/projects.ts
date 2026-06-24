import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity, requireUserId } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    // Compute live `spent` per project by summing linked expenses.
    const allExpenses = await ctx.db
      .query("a2e_expenses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const allInvoices = await ctx.db
      .query("a2e_invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

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

    return projects.map((p) => {
      const spent = allExpenses
        .filter((e) => e.projectId === p._id && e.type === "expense")
        .reduce((a, e) => a + e.amount, 0);
      const income = allExpenses
        .filter((e) => e.projectId === p._id && e.type === "income")
        .reduce((a, e) => a + e.amount, 0);
      const invoiced = allInvoices
        .filter((i) => i.projectId === p._id)
        .reduce(
          (a, i) =>
            a + (i.items || []).reduce((b, it) => b + it.quantity * it.unitPrice, 0),
          0,
        );
      const projTasks = allTasks.filter((t) => t.projectId === p._id);
      const taskTotal = projTasks.length;
      const taskDone = projTasks.filter((t) => doneKeys.has(t.status)).length;
      const memberCount = memberRows.filter((m) => m.projectId === p._id).length;
      return { ...p, spent, income, invoiced, taskTotal, taskDone, memberCount };
    });
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
    budget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    autoCreateBudget: v.optional(v.boolean()),
    autoCreateFiche: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      name: args.name,
      client: args.client,
      status: args.status,
      budget: args.budget ?? 0,
      spent: 0,
      startDate: args.startDate,
      endDate: args.endDate,
      description: args.description,
      color: args.color,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create budget when project has a budget
    if (args.autoCreateBudget && (args.budget ?? 0) > 0) {
      await ctx.db.insert("a2e_budgets", {
        workspaceId: args.workspaceId,
        name: `${args.name} — Budget`,
        amount: args.budget!,
        category: "other",
        period: "custom",
        startDate: args.startDate ?? now,
        endDate: args.endDate,
        color: args.color ?? "#22c55e",
        currency: args.currency ?? "EUR",
        spent: 0,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

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
    budget: v.optional(v.number()),
    spent: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    const { userId } = await assertWorkspaceMember(ctx, p.workspaceId, "member");
    const { projectId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
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
    const { userId } = await assertWorkspaceMember(ctx, p.workspaceId, "admin");
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

/** Recalculate `spent` for a project from linked invoices/expenses. */
export const recalcSpend = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.projectId);
    if (!p) throw new Error("Project not found");
    await assertWorkspaceMember(ctx, p.workspaceId);
    const exps = await ctx.db
      .query("a2e_expenses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const spent = exps.reduce(
      (acc, e) => acc + (e.type === "expense" ? e.amount : 0),
      0,
    );
    await ctx.db.patch(args.projectId, { spent, updatedAt: Date.now() });
    return spent;
  },
});

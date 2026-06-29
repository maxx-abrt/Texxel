import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("a2e_expenses")
      .withIndex("by_workspace_date", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { expenseId: v.id("a2e_expenses") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.expenseId);
    if (!e) return null;
    await assertWorkspaceMember(ctx, e.workspaceId);
    return e;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    sheetId: v.optional(v.id("a2e_bookSheets")),
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    date: v.number(),
    paymentMethod: v.string(),
    type: v.union(v.literal("expense"), v.literal("income")),
    notes: v.optional(v.string()),
    isRecurring: v.optional(v.boolean()),
    recurringFrequency: v.optional(
      v.union(
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("yearly"),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    currency: v.optional(v.string()),
    linkedInvoice: v.optional(v.id("a2e_invoices")),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(
      ctx,
      args.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_expenses", {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      sheetId: args.sheetId,
      description: args.description,
      amount: args.amount,
      category: args.category,
      date: args.date,
      paymentMethod: args.paymentMethod,
      type: args.type,
      notes: args.notes,
      linkedDocuments: [],
      linkedInvoice: args.linkedInvoice,
      linkedBookEntries: [],
      isRecurring: args.isRecurring,
      recurringFrequency: args.recurringFrequency,
      tags: args.tags ?? [],
      currency: args.currency ?? "EUR",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: args.type === "income" ? "income.created" : "expense.created",
      targetType: "expense",
      targetId: id,
      metadata: { amount: args.amount, category: args.category },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    expenseId: v.id("a2e_expenses"),
    projectId: v.optional(v.id("projects")),
    sheetId: v.optional(v.id("a2e_bookSheets")),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    category: v.optional(v.string()),
    date: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    notes: v.optional(v.string()),
    isRecurring: v.optional(v.boolean()),
    recurringFrequency: v.optional(
      v.union(
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("yearly"),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    currency: v.optional(v.string()),
    linkedInvoice: v.optional(v.id("a2e_invoices")),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedBookEntries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.expenseId);
    if (!e) throw new Error("Expense not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      e.workspaceId,
      "member",
    );
    const { expenseId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.expenseId, patch);
    await logActivity(ctx, {
      workspaceId: e.workspaceId,
      actorId: userId,
      action: "expense.updated",
      targetType: "expense",
      targetId: args.expenseId,
    });
    return args.expenseId;
  },
});

export const listBySheet = query({
  args: { sheetId: v.id("a2e_bookSheets") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sheetId);
    if (!s) return [];
    await assertWorkspaceMember(ctx, s.workspaceId);
    const exps = await ctx.db
      .query("a2e_expenses")
      .withIndex("by_sheet", (q) => q.eq("sheetId", args.sheetId))
      .order("desc")
      .collect();
    return exps;
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];
    await assertWorkspaceMember(ctx, project.workspaceId);
    return ctx.db
      .query("a2e_expenses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const remove = mutation({
  args: { expenseId: v.id("a2e_expenses") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.expenseId);
    if (!e) throw new Error("Expense not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      e.workspaceId,
      "member",
    );
    await ctx.db.delete(args.expenseId);
    await logActivity(ctx, {
      workspaceId: e.workspaceId,
      actorId: userId,
      action: "expense.deleted",
      targetType: "expense",
      targetId: args.expenseId,
    });
    return true;
  },
});

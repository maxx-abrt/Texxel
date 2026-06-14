import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const listSheets = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("a2e_bookSheets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const getSheet = query({
  args: { sheetId: v.id("a2e_bookSheets") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sheetId);
    if (!s) return null;
    await assertWorkspaceMember(ctx, s.workspaceId);
    return s;
  },
});

export const createSheet = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    type: v.optional(v.union(v.literal("grid"), v.literal("ledger"))),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    columns: v.optional(v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.string(),
        width: v.optional(v.number()),
        options: v.optional(v.array(v.string())),
        formula: v.optional(v.string()),
        required: v.optional(v.boolean()),
        linkedType: v.optional(v.string()),
      }),
    )),
    isTemplate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(
      ctx,
      args.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_bookSheets", {
      ...args,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "book.sheet_created",
      targetType: "book_sheet",
      targetId: id,
      metadata: { name: args.name },
    });
    return id;
  },
});

export const updateSheet = mutation({
  args: {
    sheetId: v.id("a2e_bookSheets"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("grid"), v.literal("ledger"))),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    columns: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          type: v.string(),
          width: v.optional(v.number()),
          options: v.optional(v.array(v.string())),
          formula: v.optional(v.string()),
          required: v.optional(v.boolean()),
          linkedType: v.optional(v.string()),
        }),
      ),
    ),
    isTemplate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sheetId);
    if (!s) throw new Error("Sheet not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      s.workspaceId,
      "member",
    );
    const { sheetId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest))
      if (val !== undefined) patch[k] = val;
    await ctx.db.patch(args.sheetId, patch);
    await logActivity(ctx, {
      workspaceId: s.workspaceId,
      actorId: userId,
      action: "book.sheet_updated",
      targetType: "book_sheet",
      targetId: args.sheetId,
    });
    return args.sheetId;
  },
});

export const removeSheet = mutation({
  args: { sheetId: v.id("a2e_bookSheets") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sheetId);
    if (!s) throw new Error("Sheet not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      s.workspaceId,
      "member",
    );
    const entries = await ctx.db
      .query("a2e_bookEntries")
      .withIndex("by_sheet", (q) => q.eq("sheetId", args.sheetId))
      .collect();
    for (const e of entries) await ctx.db.delete(e._id);
    // Unlink any expenses tied to this ledger sheet
    const expenses = await ctx.db
      .query("a2e_expenses")
      .withIndex("by_sheet", (q) => q.eq("sheetId", args.sheetId))
      .collect();
    for (const exp of expenses) {
      await ctx.db.patch(exp._id, { sheetId: undefined });
    }
    await ctx.db.delete(args.sheetId);
    await logActivity(ctx, {
      workspaceId: s.workspaceId,
      actorId: userId,
      action: "book.sheet_deleted",
      targetType: "book_sheet",
      targetId: args.sheetId,
    });
    return true;
  },
});

export const listEntries = query({
  args: { sheetId: v.id("a2e_bookSheets") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sheetId);
    if (!s) return [];
    await assertWorkspaceMember(ctx, s.workspaceId);
    return ctx.db
      .query("a2e_bookEntries")
      .withIndex("by_sheet", (q) => q.eq("sheetId", args.sheetId))
      .order("desc")
      .collect();
  },
});

export const createEntry = mutation({
  args: {
    sheetId: v.id("a2e_bookSheets"),
    cells: v.any(),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedExpenses: v.optional(v.array(v.id("a2e_expenses"))),
    linkedInvoices: v.optional(v.array(v.id("a2e_invoices"))),
    linkedProjectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sheetId);
    if (!s) throw new Error("Sheet not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      s.workspaceId,
      "member",
    );
    const now = Date.now();
    const id = await ctx.db.insert("a2e_bookEntries", {
      workspaceId: s.workspaceId,
      sheetId: args.sheetId,
      cells: args.cells ?? {},
      linkedDocuments: args.linkedDocuments ?? [],
      linkedExpenses: args.linkedExpenses ?? [],
      linkedInvoices: args.linkedInvoices ?? [],
      linkedProjectId: args.linkedProjectId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.sheetId, { updatedAt: now });
    await logActivity(ctx, {
      workspaceId: s.workspaceId,
      actorId: userId,
      action: "book.entry_created",
      targetType: "book_entry",
      targetId: id,
    });
    return id;
  },
});

export const updateEntry = mutation({
  args: {
    entryId: v.id("a2e_bookEntries"),
    cells: v.optional(v.any()),
    linkedDocuments: v.optional(v.array(v.string())),
    linkedExpenses: v.optional(v.array(v.id("a2e_expenses"))),
    linkedInvoices: v.optional(v.array(v.id("a2e_invoices"))),
    linkedProjectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.entryId);
    if (!e) throw new Error("Entry not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      e.workspaceId,
      "member",
    );
    const { entryId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest))
      if (val !== undefined) patch[k] = val;
    await ctx.db.patch(args.entryId, patch);
    await ctx.db.patch(e.sheetId, { updatedAt: Date.now() });
    return args.entryId;
  },
});

export const removeEntry = mutation({
  args: { entryId: v.id("a2e_bookEntries") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.entryId);
    if (!e) throw new Error("Entry not found");
    const { userId } = await assertWorkspaceMember(
      ctx,
      e.workspaceId,
      "member",
    );
    await ctx.db.delete(args.entryId);
    await ctx.db.patch(e.sheetId, { updatedAt: Date.now() });
    return true;
  },
});

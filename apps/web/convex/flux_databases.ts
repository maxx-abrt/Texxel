import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const dbs = await ctx.db
      .query("flux_databases")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return dbs.filter((d) => !d.isArchived).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { databaseId: v.id("flux_databases") },
  handler: async (ctx, args) => {
    const db = await ctx.db.get(args.databaseId);
    if (!db) return null;
    await assertWorkspaceMember(ctx, db.workspaceId);
    return db;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    columns: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const defaultCols = JSON.stringify([
      { id: "name", name: "Name", type: "text" },
      { id: "status", name: "Status", type: "select", options: ["Todo", "Doing", "Done"] },
      { id: "date", name: "Date", type: "date" },
    ]);
    const id = await ctx.db.insert("flux_databases", {
      workspaceId: args.workspaceId,
      title: args.title,
      description: args.description,
      icon: args.icon,
      color: args.color,
      columns: args.columns ?? defaultCols,
      isArchived: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "database.created",
      targetType: "flux_database",
      targetId: id,
      metadata: { title: args.title },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    databaseId: v.id("flux_databases"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    columns: v.optional(v.string()),
    viewType: v.optional(v.string()),
    viewConfig: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const db = await ctx.db.get(args.databaseId);
    if (!db) throw new Error("Database not found");
    await assertWorkspaceMember(ctx, db.workspaceId, "member");
    const { databaseId, ...rest } = args;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val;
    await ctx.db.patch(args.databaseId, patch);
    return args.databaseId;
  },
});

export const remove = mutation({
  args: { databaseId: v.id("flux_databases") },
  handler: async (ctx, args) => {
    const db = await ctx.db.get(args.databaseId);
    if (!db) throw new Error("Database not found");
    await assertWorkspaceMember(ctx, db.workspaceId, "member");
    const rows = await ctx.db
      .query("flux_databaseRows")
      .withIndex("by_database", (q) => q.eq("databaseId", args.databaseId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.delete(args.databaseId);
    return true;
  },
});

export const listRows = query({
  args: { databaseId: v.id("flux_databases") },
  handler: async (ctx, args) => {
    const db = await ctx.db.get(args.databaseId);
    if (!db) return [];
    await assertWorkspaceMember(ctx, db.workspaceId);
    const rows = await ctx.db
      .query("flux_databaseRows")
      .withIndex("by_database", (q) => q.eq("databaseId", args.databaseId))
      .collect();
    return rows.sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
  },
});

export const addRow = mutation({
  args: { databaseId: v.id("flux_databases"), cells: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const db = await ctx.db.get(args.databaseId);
    if (!db) throw new Error("Database not found");
    const { userId } = await assertWorkspaceMember(ctx, db.workspaceId, "member");
    const now = Date.now();
    return await ctx.db.insert("flux_databaseRows", {
      databaseId: args.databaseId,
      workspaceId: db.workspaceId,
      cells: args.cells ?? "{}",
      order: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRow = mutation({
  args: { rowId: v.id("flux_databaseRows"), cells: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.rowId);
    if (!row) throw new Error("Row not found");
    await assertWorkspaceMember(ctx, row.workspaceId, "member");
    await ctx.db.patch(args.rowId, { cells: args.cells, updatedAt: Date.now() });
    return args.rowId;
  },
});

export const removeRow = mutation({
  args: { rowId: v.id("flux_databaseRows") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.rowId);
    if (!row) throw new Error("Row not found");
    await assertWorkspaceMember(ctx, row.workspaceId, "member");
    await ctx.db.delete(args.rowId);
    return true;
  },
});


/** Bulk-import rows (e.g. from a CSV). Each entry is a JSON cells string. */
export const importRows = mutation({
  args: {
    databaseId: v.id("flux_databases"),
    rows: v.array(v.string()),
    columns: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const db = await ctx.db.get(args.databaseId);
    if (!db) throw new Error("Database not found");
    const { userId } = await assertWorkspaceMember(ctx, db.workspaceId, "member");
    if (args.columns) await ctx.db.patch(args.databaseId, { columns: args.columns, updatedAt: Date.now() });
    let now = Date.now();
    let count = 0;
    for (const cells of args.rows) {
      await ctx.db.insert("flux_databaseRows", {
        databaseId: args.databaseId,
        workspaceId: db.workspaceId,
        cells,
        order: now++,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      count++;
    }
    return count;
  },
});

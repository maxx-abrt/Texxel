import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getMyDatabases = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const all = await ctx.db
      .query("databases")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect()
      .then((dbs) => dbs.filter((d) => !d.isArchived));
    if (!args.workspaceId) return all;
    return all.filter((d) => d.workspaceId === args.workspaceId);
  },
});

export const getById = query({
  args: { id: v.id("databases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getRows = query({
  args: { databaseId: v.id("databases") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("databaseRows")
      .withIndex("by_database", (q) => q.eq("databaseId", args.databaseId))
      .collect();
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    columns: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const defaultColumns = JSON.stringify([
      { id: "col_name", name: "Name", type: "text", width: 260 },
      { id: "col_status", name: "Status", type: "select", options: ["To Do", "In Progress", "Done"], width: 140 },
      { id: "col_tags", name: "Tags", type: "multiSelect", options: ["Important", "Bug", "Feature"], width: 160 },
    ]);

    const now = Date.now();
    return await ctx.db.insert("databases", {
      title: args.title,
      description: args.description,
      icon: args.icon,
      color: args.color,
      columns: args.columns ?? defaultColumns,
      ownerId: identity.subject,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      teamId: args.teamId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("databases"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    columns: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const db = await ctx.db.get(args.id);
    if (!db || db.ownerId !== identity.subject) throw new Error("Not authorized");
    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("databases") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const db = await ctx.db.get(args.id);
    if (!db || db.ownerId !== identity.subject) throw new Error("Not authorized");
    // Delete all rows
    const rows = await ctx.db
      .query("databaseRows")
      .withIndex("by_database", (q) => q.eq("databaseId", args.id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.delete(args.id);
  },
});

// ─── Row mutations ───────────────────────────────────────────────────────────

export const addRow = mutation({
  args: {
    databaseId: v.id("databases"),
    cells: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const now = Date.now();

    // Get next order
    const existing = await ctx.db
      .query("databaseRows")
      .withIndex("by_database", (q) => q.eq("databaseId", args.databaseId))
      .collect();
    const maxOrder = existing.reduce((max, r) => Math.max(max, r.order ?? 0), 0);

    return await ctx.db.insert("databaseRows", {
      databaseId: args.databaseId,
      cells: args.cells ?? "{}",
      order: maxOrder + 1,
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRow = mutation({
  args: {
    id: v.id("databaseRows"),
    cells: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.patch(args.id, { cells: args.cells, updatedAt: Date.now() });
  },
});

export const deleteRow = mutation({
  args: { id: v.id("databaseRows") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.delete(args.id);
  },
});

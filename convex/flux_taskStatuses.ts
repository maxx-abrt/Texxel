import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

// Built-in defaults. Seeded into flux_taskStatuses on first access so they can
// be renamed/recolored/reordered like any custom status.
export const DEFAULT_STATUSES = [
  { key: "todo", label: "To do", color: "#2f7ea6", order: 0, isDone: false },
  { key: "in_progress", label: "In progress", color: "#d98324", order: 1, isDone: false },
  { key: "done", label: "Done", color: "#2fbf9b", order: 2, isDone: true },
];

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "")
      .slice(0, 32) || `status_${Math.random().toString(36).slice(2, 7)}`
  );
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (rows.length === 0) {
      // Virtual defaults until ensureDefaults seeds real rows.
      return DEFAULT_STATUSES.map((s) => ({
        _id: null,
        workspaceId: args.workspaceId,
        ...s,
      }));
    }
    return rows.sort((a, b) => a.order - b.order);
  },
});

export const ensureDefaults = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const existing = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (existing.length > 0) return existing.length;
    const now = Date.now();
    for (const s of DEFAULT_STATUSES) {
      await ctx.db.insert("flux_taskStatuses", {
        workspaceId: args.workspaceId,
        key: s.key,
        label: s.label,
        color: s.color,
        order: s.order,
        isDone: s.isDone,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return DEFAULT_STATUSES.length;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    label: v.string(),
    color: v.string(),
    isDone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const rows = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    // Seed defaults first if empty so we never end up with a single orphan.
    const now = Date.now();
    if (rows.length === 0) {
      for (const s of DEFAULT_STATUSES) {
        await ctx.db.insert("flux_taskStatuses", {
          workspaceId: args.workspaceId,
          key: s.key,
          label: s.label,
          color: s.color,
          order: s.order,
          isDone: s.isDone,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const all = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    let key = slugify(args.label);
    if (all.some((r) => r.key === key)) key = `${key}_${Math.random().toString(36).slice(2, 5)}`;
    const order = all.reduce((m, r) => Math.max(m, r.order), -1) + 1;
    const id = await ctx.db.insert("flux_taskStatuses", {
      workspaceId: args.workspaceId,
      key,
      label: args.label,
      color: args.color,
      order,
      isDone: args.isDone ?? false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    statusId: v.id("flux_taskStatuses"),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
    isDone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.statusId);
    if (!s) throw new Error("Status not found");
    await assertWorkspaceMember(ctx, s.workspaceId, "member");
    const patch: any = { updatedAt: Date.now() };
    for (const k of ["label", "color", "isDone"] as const) {
      if ((args as any)[k] !== undefined) patch[k] = (args as any)[k];
    }
    await ctx.db.patch(args.statusId, patch);
    return args.statusId;
  },
});

export const reorder = mutation({
  args: { workspaceId: v.id("workspaces"), orderedIds: v.array(v.id("flux_taskStatuses")) },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId, "member");
    let i = 0;
    for (const id of args.orderedIds) {
      const s = await ctx.db.get(id);
      if (s && s.workspaceId === args.workspaceId) {
        await ctx.db.patch(id, { order: i, updatedAt: Date.now() });
      }
      i++;
    }
    return true;
  },
});

export const remove = mutation({
  args: { statusId: v.id("flux_taskStatuses") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.statusId);
    if (!s) throw new Error("Status not found");
    await assertWorkspaceMember(ctx, s.workspaceId, "member");
    const all = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", s.workspaceId))
      .collect();
    if (all.length <= 1) throw new Error("A workspace must keep at least one status");
    // Reassign tasks of this status to the first remaining status.
    const fallback = all.filter((r) => r._id !== args.statusId).sort((a, b) => a.order - b.order)[0];
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", s.workspaceId))
      .collect();
    for (const t of tasks) {
      if (t.status === s.key) {
        await ctx.db.patch(t._id, { status: fallback.key, updatedAt: Date.now() });
      }
    }
    await ctx.db.delete(args.statusId);
    return true;
  },
});

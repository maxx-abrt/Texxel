import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("flux_labels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const name = args.name.trim();
    if (!name) throw new Error("Label name required");
    const existing = await ctx.db
      .query("flux_labels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const found = existing.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (found) return found._id;
    const PALETTE = ["#e5484d", "#d98324", "#2fbf9b", "#2f7ea6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    const color = args.color ?? PALETTE[existing.length % PALETTE.length];
    return ctx.db.insert("flux_labels", {
      workspaceId: args.workspaceId,
      name,
      color,
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { labelId: v.id("flux_labels"), name: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const l = await ctx.db.get(args.labelId);
    if (!l) throw new Error("Label not found");
    await assertWorkspaceMember(ctx, l.workspaceId, "member");
    const patch: any = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.color !== undefined) patch.color = args.color;
    await ctx.db.patch(args.labelId, patch);
    return args.labelId;
  },
});

export const remove = mutation({
  args: { labelId: v.id("flux_labels") },
  handler: async (ctx, args) => {
    const l = await ctx.db.get(args.labelId);
    if (!l) throw new Error("Label not found");
    await assertWorkspaceMember(ctx, l.workspaceId, "member");
    // Strip this label name from any task metas that reference it.
    const metas = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", l.workspaceId))
      .collect();
    for (const m of metas) {
      if (m.labels && m.labels.includes(l.name)) {
        await ctx.db.patch(m._id, {
          labels: m.labels.filter((x: string) => x !== l.name),
          updatedAt: Date.now(),
        });
      }
    }
    await ctx.db.delete(args.labelId);
    return true;
  },
});

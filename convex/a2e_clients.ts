import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    return ctx.db
      .query("a2e_clients")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { clientId: v.id("a2e_clients") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.clientId);
    if (!c) return null;
    await assertWorkspaceMember(ctx, c.workspaceId);
    return c;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    siret: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("a2e_clients", {
      ...args,
      totalInvoiced: 0,
      totalPaid: 0,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "client.created",
      targetType: "client",
      targetId: id,
      metadata: { name: args.name },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    clientId: v.id("a2e_clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    siret: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.clientId);
    if (!c) throw new Error("Client not found");
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId, "member");
    const { clientId, ...rest } = args as any;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest))
      if (val !== undefined) patch[k] = val;
    await ctx.db.patch(args.clientId, patch);
    await logActivity(ctx, {
      workspaceId: c.workspaceId,
      actorId: userId,
      action: "client.updated",
      targetType: "client",
      targetId: args.clientId,
    });
    return args.clientId;
  },
});

export const remove = mutation({
  args: { clientId: v.id("a2e_clients") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.clientId);
    if (!c) throw new Error("Client not found");
    const { userId } = await assertWorkspaceMember(ctx, c.workspaceId, "member");
    await ctx.db.delete(args.clientId);
    await logActivity(ctx, {
      workspaceId: c.workspaceId,
      actorId: userId,
      action: "client.deleted",
      targetType: "client",
      targetId: args.clientId,
    });
    return true;
  },
});

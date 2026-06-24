import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    let events = await ctx.db
      .query("flux_events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (args.start !== undefined) events = events.filter((e) => (e.end ?? e.start) >= args.start!);
    if (args.end !== undefined) events = events.filter((e) => e.start <= args.end!);
    return events.sort((a, b) => a.start - b.start);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.number(),
    end: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    recurrence: v.optional(v.string()),
    recurrenceUntil: v.optional(v.number()),
    color: v.optional(v.string()),
    location: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const { userId } = await assertWorkspaceMember(ctx, args.workspaceId, "member");
    const now = Date.now();
    const id = await ctx.db.insert("flux_events", {
      workspaceId: args.workspaceId,
      title: args.title,
      description: args.description,
      start: args.start,
      end: args.end,
      allDay: args.allDay,
      recurrence: args.recurrence,
      recurrenceUntil: args.recurrenceUntil,
      color: args.color,
      location: args.location,
      projectId: args.projectId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      actorId: userId,
      action: "event.created",
      targetType: "flux_event",
      targetId: id,
      metadata: { title: args.title },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    eventId: v.id("flux_events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    recurrence: v.optional(v.string()),
    recurrenceUntil: v.optional(v.number()),
    color: v.optional(v.string()),
    location: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.eventId);
    if (!e) throw new Error("Event not found");
    await assertWorkspaceMember(ctx, e.workspaceId, "member");
    const { eventId, ...rest } = args;
    const patch: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val;
    await ctx.db.patch(args.eventId, patch);
    return args.eventId;
  },
});

export const remove = mutation({
  args: { eventId: v.id("flux_events") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.eventId);
    if (!e) throw new Error("Event not found");
    await assertWorkspaceMember(ctx, e.workspaceId, "member");
    await ctx.db.delete(args.eventId);
    return true;
  },
});

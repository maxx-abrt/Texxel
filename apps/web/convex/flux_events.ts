import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember, logActivity } from "./lib/auth";
import { expandEvents } from "../lib/recurrence";

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
    recurrenceFreq: v.optional(
      v.union(v.literal("none"), v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
    recurrenceInterval: v.optional(v.number()),
    recurrenceDaysOfWeek: v.optional(v.array(v.number())),
    recurrenceMonthlyPosition: v.optional(
      v.union(
        v.literal("same_day"),
        v.literal("first"),
        v.literal("second"),
        v.literal("third"),
        v.literal("fourth"),
        v.literal("last"),
      ),
    ),
    recurrenceEndAfter: v.optional(v.number()),
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
      recurrenceFreq: args.recurrenceFreq,
      recurrenceInterval: args.recurrenceInterval,
      recurrenceDaysOfWeek: args.recurrenceDaysOfWeek,
      recurrenceMonthlyPosition: args.recurrenceMonthlyPosition,
      recurrenceEndAfter: args.recurrenceEndAfter,
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
    recurrenceFreq: v.optional(
      v.union(v.literal("none"), v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    ),
    recurrenceInterval: v.optional(v.number()),
    recurrenceDaysOfWeek: v.optional(v.array(v.number())),
    recurrenceMonthlyPosition: v.optional(
      v.union(
        v.literal("same_day"),
        v.literal("first"),
        v.literal("second"),
        v.literal("third"),
        v.literal("fourth"),
        v.literal("last"),
      ),
    ),
    recurrenceEndAfter: v.optional(v.number()),
    recurrenceUntil: v.optional(v.number()),
    recurrenceExceptions: v.optional(v.array(v.number())),
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

/** Detach a single occurrence from a recurring series.
 *  Creates a standalone copy of the event at occurrenceStart, then marks
 *  that timestamp as an exception so the original series skips it. */
export const detachOccurrence = mutation({
  args: {
    eventId: v.id("flux_events"),
    occurrenceStart: v.number(),
  },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.eventId);
    if (!e) throw new Error("Event not found");
    const { userId } = await assertWorkspaceMember(ctx, e.workspaceId, "member");
    const dur = e.end != null ? e.end - e.start : 60 * 60000;
    const newId = await ctx.db.insert("flux_events", {
      workspaceId: e.workspaceId,
      title: e.title,
      description: e.description,
      start: args.occurrenceStart,
      end: args.occurrenceStart + dur,
      allDay: e.allDay,
      color: e.color,
      location: e.location,
      projectId: e.projectId,
      taskId: e.taskId,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const existing = (e as any).recurrenceExceptions ?? [];
    await ctx.db.patch(args.eventId, {
      recurrenceExceptions: [...existing, args.occurrenceStart],
      updatedAt: Date.now(),
    });
    return newId;
  },
});

/** Delete a single occurrence of a recurring event without touching the series. */
export const skipOccurrence = mutation({
  args: {
    eventId: v.id("flux_events"),
    occurrenceStart: v.number(),
  },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.eventId);
    if (!e) throw new Error("Event not found");
    await assertWorkspaceMember(ctx, e.workspaceId, "member");
    const existing = (e as any).recurrenceExceptions ?? [];
    await ctx.db.patch(args.eventId, {
      recurrenceExceptions: [...existing, args.occurrenceStart],
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** List events with their recurrence expanded into concrete occurrences.
 *  Useful for server-side consumers that need ready-to-render occurrences.
 */
export const listExpanded = query({
  args: {
    workspaceId: v.id("workspaces"),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);
    const events = await ctx.db
      .query("flux_events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return expandEvents(events, args.start, args.end);
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

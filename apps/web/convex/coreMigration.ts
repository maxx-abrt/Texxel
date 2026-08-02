import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertWorkspaceMember } from "./lib/auth";
import { Id } from "./_generated/dataModel";

/**
 * One-shot migration of Bureau's legacy local data into the shared A2E Core
 * deployment (tasks, task statuses, labels, calendar events).
 *
 * Design notes:
 * - Core rows can only be created with the USER's token (client side), so this
 *   module only *reads* what is left to migrate and *stamps* the local row once
 *   its core twin exists (`tasks.coreTaskId`, `flux_events.coreEventId`).
 * - Idempotent by construction: a stamped row is never returned again, so the
 *   migration is resumable and safe to re-run.
 * - Local rows are kept (guide §12.4: dual read); the UI reads core when the
 *   core flags are on, so nothing is displayed twice.
 */

const BATCH = 100;

export const pending = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await assertWorkspaceMember(ctx, args.workspaceId);

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const allEvents = await ctx.db
      .query("flux_events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const tasksLeft = allTasks.filter((t) => !t.coreTaskId);
    const eventsLeft = allEvents.filter((e) => !e.coreEventId);

    // Parents first so `parentId` can be remapped to the core id in one pass.
    const rootsFirst = [
      ...tasksLeft.filter((t) => !t.parentId),
      ...tasksLeft.filter((t) => !!t.parentId),
    ].slice(0, BATCH);

    // Local user id → email, so the client can map assignees to CORE user ids
    // (core member ids differ from local ones; email is the stable join key).
    const userIds = new Set<Id<"users">>();
    for (const t of rootsFirst) if (t.assigneeId) userIds.add(t.assigneeId);
    const emailByUserId: Record<string, string> = {};
    for (const id of userIds) {
      const u = await ctx.db.get(id);
      if (u?.email) emailByUserId[id] = u.email;
    }

    // Already-migrated parents (for subtasks whose parent went in a past batch).
    const coreIdByLocalTask: Record<string, string> = {};
    for (const t of allTasks) if (t.coreTaskId) coreIdByLocalTask[t._id] = t.coreTaskId;

    const statuses = await ctx.db
      .query("flux_taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const labels = await ctx.db
      .query("flux_labels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const metas = await ctx.db
      .query("flux_taskMeta")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const metaByTask = new Map(metas.map((m) => [String(m.taskId), m]));

    return {
      totals: { tasks: tasksLeft.length, events: eventsLeft.length },
      statuses: statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, order: s.order, isDone: s.isDone })),
      labels: labels.map((l) => ({ name: l.name, color: l.color })),
      emailByUserId,
      coreIdByLocalTask,
      tasks: rootsFirst.map((t) => {
        const meta = metaByTask.get(String(t._id)) as
          | { priority?: string; labels?: string[]; estimateMinutes?: number; startDate?: number }
          | undefined;
        return {
          _id: t._id,
          title: t.title,
          description: t.description,
          status: t.status,
          assigneeId: t.assigneeId ?? null,
          dueDate: t.dueDate,
          parentId: t.parentId ?? null,
          projectId: t.projectId ?? null,
          priority: meta?.priority,
          labels: meta?.labels,
          estimateMinutes: meta?.estimateMinutes,
          startDate: meta?.startDate,
        };
      }),
      events: eventsLeft.slice(0, BATCH).map((e) => ({
        _id: e._id,
        title: e.title,
        description: e.description,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        color: e.color,
        location: e.location,
        projectId: e.projectId ?? null,
        recurrenceFreq: e.recurrenceFreq,
        recurrenceInterval: e.recurrenceInterval,
        recurrenceDaysOfWeek: e.recurrenceDaysOfWeek,
        recurrenceMonthlyPosition: e.recurrenceMonthlyPosition,
        recurrenceEndAfter: e.recurrenceEndAfter,
        recurrenceUntil: e.recurrenceUntil,
        recurrenceExceptions: e.recurrenceExceptions,
      })),
    };
  },
});

export const stampTask = mutation({
  args: { taskId: v.id("tasks"), coreTaskId: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertWorkspaceMember(ctx, task.workspaceId);
    if (task.coreTaskId) return task.coreTaskId; // already migrated — never twice
    await ctx.db.patch(args.taskId, { coreTaskId: args.coreTaskId, updatedAt: Date.now() });
    return args.coreTaskId;
  },
});

export const stampEvent = mutation({
  args: { eventId: v.id("flux_events"), coreEventId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;
    await assertWorkspaceMember(ctx, event.workspaceId);
    if (event.coreEventId) return event.coreEventId;
    await ctx.db.patch(args.eventId, { coreEventId: args.coreEventId, updatedAt: Date.now() });
    return args.coreEventId;
  },
});

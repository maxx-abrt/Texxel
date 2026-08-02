"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { useTaskMutations, useTaskStatuses, useEventMutations, useMembers } from "@a2e/core";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { useCoreWorkspaceId } from "@/hooks/use-core-workspace-id";

/**
 * Migrates this workspace's legacy LOCAL data (tasks + statuses + labels +
 * calendar events) into the shared A2E Core deployment.
 *
 * Runs with the user's own token — core rows are created through the normal
 * `@a2e/core` mutations, so every core-side check (membership, permissions,
 * quotas, activity log) applies exactly as for a manual creation.
 *
 * Idempotent & resumable: `convex/coreMigration.pending` only returns rows that
 * have no core twin yet, and each created row is stamped immediately
 * (`tasks.coreTaskId` / `flux_events.coreEventId`). Interrupting the run (closing
 * the tab, quota hit, network) loses nothing: press again and it continues.
 */
export type MigrationProgress = {
  running: boolean;
  done: number;
  total: number;
  step: "idle" | "statuses" | "tasks" | "events" | "finished";
  errors: string[];
};

const EMPTY: MigrationProgress = { running: false, done: 0, total: 0, step: "idle", errors: [] };

export function useCoreMigration() {
  const { activeWorkspaceId } = useWorkspace();
  const coreWs = useCoreWorkspaceId();

  const pending = useQuery(
    api.coreMigration.pending,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const stampTask = useMutation(api.coreMigration.stampTask);
  const stampEvent = useMutation(api.coreMigration.stampEvent);

  const coreStatuses = useTaskStatuses(coreWs as never);
  const coreMembers = useMembers(coreWs as never);
  const { create: createTask, createStatus } = useTaskMutations();
  const { create: createEvent } = useEventMutations();

  const [progress, setProgress] = React.useState<MigrationProgress>(EMPTY);

  const remaining = (pending?.totals.tasks ?? 0) + (pending?.totals.events ?? 0);
  const canRun = !!coreWs && !!activeWorkspaceId && remaining > 0 && !progress.running;

  const run = React.useCallback(async () => {
    if (!coreWs || !activeWorkspaceId) return;
    const errors: string[] = [];
    let done = 0;
    setProgress({ running: true, done: 0, total: remaining, step: "statuses", errors });

    // 1. Custom statuses: core auto-seeds todo/in_progress/done, so only the
    //    workspace's extra statuses have to be recreated (same key = same tasks).
    const existing = new Set((coreStatuses ?? []).map((s) => s.key));
    for (const status of pending?.statuses ?? []) {
      if (existing.has(status.key)) continue;
      try {
        await createStatus({
          workspaceId: coreWs as never,
          key: status.key,
          label: status.label,
          color: status.color,
          order: status.order,
          isDone: status.isDone,
        } as never);
        existing.add(status.key);
      } catch (err) {
        errors.push(`statut "${status.label}": ${message(err)}`);
      }
    }

    // 2. Assignees: local user id → email → core member id.
    const coreIdByEmail = new Map(
      (coreMembers ?? []).map((m: { _id: string; email?: string | null }) => [
        (m.email ?? "").toLowerCase(),
        m._id,
      ]),
    );
    const coreAssignee = (localUserId: string | null) => {
      if (!localUserId) return undefined;
      const email = (pending?.emailByUserId as Record<string, string> | undefined)?.[localUserId];
      return email ? coreIdByEmail.get(email.toLowerCase()) : undefined;
    };

    // 3. Tasks — batch by batch, parents before children so `parentId` maps.
    setProgress((p) => ({ ...p, step: "tasks" }));
    const coreIdByLocal = new Map<string, string>(
      Object.entries((pending?.coreIdByLocalTask ?? {}) as Record<string, string>),
    );
    for (const task of pending?.tasks ?? []) {
      try {
        const coreId = await createTask({
          workspaceId: coreWs as never,
          title: task.title,
          description: task.description,
          status: existing.has(task.status) ? task.status : undefined,
          priority: task.priority as never,
          assigneeId: coreAssignee(task.assigneeId) as never,
          dueDate: task.dueDate,
          startDate: task.startDate,
          estimateMinutes: task.estimateMinutes,
          labels: task.labels,
          parentId: (task.parentId ? coreIdByLocal.get(String(task.parentId)) : undefined) as never,
          sourceApp: "bureau",
          linkedTo: task.projectId
            ? { app: "bureau", type: "project", id: String(task.projectId) }
            : undefined,
        } as never);
        coreIdByLocal.set(String(task._id), String(coreId));
        await stampTask({ taskId: task._id, coreTaskId: String(coreId) });
      } catch (err) {
        errors.push(`tâche "${task.title}": ${message(err)}`);
      }
      done += 1;
      setProgress((p) => ({ ...p, done, errors: [...errors] }));
    }

    // 4. Events (one row per series, recurrence included).
    setProgress((p) => ({ ...p, step: "events" }));
    for (const event of pending?.events ?? []) {
      try {
        const coreId = await createEvent({
          workspaceId: coreWs as never,
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          color: event.color,
          location: event.location,
          sourceApp: "bureau",
          linkedTo: event.projectId
            ? { app: "bureau", type: "project", id: String(event.projectId) }
            : undefined,
          recurrenceFreq: event.recurrenceFreq as never,
          recurrenceInterval: event.recurrenceInterval,
          recurrenceDaysOfWeek: event.recurrenceDaysOfWeek,
          recurrenceMonthlyPosition: event.recurrenceMonthlyPosition as never,
          recurrenceEndAfter: event.recurrenceEndAfter,
          recurrenceUntil: event.recurrenceUntil,
          recurrenceExceptions: event.recurrenceExceptions,
        } as never);
        await stampEvent({ eventId: event._id, coreEventId: String(coreId) });
      } catch (err) {
        errors.push(`événement "${event.title}": ${message(err)}`);
      }
      done += 1;
      setProgress((p) => ({ ...p, done, errors: [...errors] }));
    }

    setProgress((p) => ({ ...p, running: false, step: "finished", errors: [...errors] }));
  }, [
    coreWs,
    activeWorkspaceId,
    remaining,
    pending,
    coreStatuses,
    coreMembers,
    createStatus,
    createTask,
    createEvent,
    stampTask,
    stampEvent,
  ]);

  return {
    /** Rows left to migrate in this workspace (0 = nothing to do). */
    remaining,
    counts: pending?.totals ?? { tasks: 0, events: 0 },
    /** More rows than the current batch → press again after this run. */
    batched: (pending?.tasks.length ?? 0) < (pending?.totals.tasks ?? 0),
    canRun,
    run,
    progress,
    ready: pending !== undefined,
  };
}

function message(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^\[.*?\]\s*/, "").slice(0, 160);
}

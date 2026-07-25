import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";

import { excerptOf } from "@/src/lib/blocks";
import { startOfDay } from "@/src/lib/format";
import { tones } from "@/src/theme/tokens";
import { convexApi, type ConvexDocument, type ConvexTask } from "./convex-api";
import type {
  Result,
  VmDoc,
  VmEvent,
  VmNotification,
  VmProject,
  VmStatus,
  VmTask,
} from "./types";
import { useWorkspace } from "./workspace-provider";

/**
 * One hook per data set. Each resolves against Convex when the user is signed
 * in, and returns empty data otherwise.
 */

const TONE_CYCLE = [tones.coral, tones.mint, tones.amber, tones.ocean, tones.violet, tones.rose];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TONE_CYCLE[hash % TONE_CYCLE.length];
}

function useScope() {
  const { live, workspaceId } = useWorkspace();
  const enabled = live && !!workspaceId;
  return { enabled, args: enabled ? ({ workspaceId } as never) : ("skip" as const) };
}

export function useStatuses(): Result<VmStatus[]> {
  const { enabled, args } = useScope();
  const rows = useQuery(convexApi.taskStatuses.list, args);

  return useMemo(() => {
    if (!enabled) return { data: [], loading: false };
    if (rows === undefined) return { data: [], loading: true };
    return {
      data: rows.map((s) => ({ key: s.key, label: s.label, color: s.color, isDone: Boolean(s.isDone) })),
      loading: false,
    };
  }, [enabled, rows]);
}

export function useProjects(): Result<VmProject[]> {
  const { enabled, args } = useScope();
  const rows = useQuery(convexApi.projects.list, args);

  return useMemo(() => {
    if (!enabled) return { data: [], loading: false };
    if (rows === undefined) return { data: [], loading: true };
    return {
      data: rows.map((p) => ({
        id: p._id,
        name: p.name,
        client: p.client,
        status: p.status,
        tone: p.color ?? toneFor(p._id),
        done: p.taskDone,
        total: p.taskTotal,
        dueDate: p.endDate ?? null,
        members: [],
      })),
      loading: false,
    };
  }, [enabled, rows]);
}

function mapTask(
  task: ConvexTask,
  statuses: VmStatus[],
  projectNames: Map<string, string>,
): VmTask {
  const status = statuses.find((s) => s.key === task.status);
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    statusLabel: status?.label ?? task.status,
    statusColor: status?.color ?? tones.ocean,
    isDone: Boolean(status?.isDone),
    priority: task.priority ?? "none",
    dueDate: task.dueDate ?? null,
    labels: task.labels ?? [],
    assignee: task.assignee ? { name: task.assignee.name ?? task.assignee.email ?? null, image: task.assignee.image } : null,
    projectId: task.projectId ?? null,
    projectName: task.projectId ? (projectNames.get(task.projectId) ?? null) : null,
    updatedAt: task.updatedAt,
  };
}

export function useTasks(): Result<VmTask[]> {
  const { enabled, args } = useScope();
  const rows = useQuery(convexApi.tasks.list, args);
  const statuses = useStatuses();
  const projects = useProjects();

  return useMemo(() => {
    if (!enabled) return { data: [], loading: false };
    if (rows === undefined) return { data: [], loading: true };
    const names = new Map(projects.data.map((p) => [p.id, p.name]));
    return { data: rows.map((t) => mapTask(t, statuses.data, names)), loading: false };
  }, [enabled, projects.data, rows, statuses.data]);
}

export function useTask(taskId?: string): Result<VmTask | null> {
  const { live } = useWorkspace();
  const statuses = useStatuses();
  const projects = useProjects();
  const row = useQuery(
    convexApi.tasks.get,
    live && taskId ? ({ taskId } as never) : "skip",
  );

  return useMemo(() => {
    if (!live) {
      return { data: null, loading: false };
    }
    if (row === undefined) return { data: null, loading: true };
    if (row === null) return { data: null, loading: false };
    const names = new Map(projects.data.map((p) => [p.id, p.name]));
    return { data: mapTask(row, statuses.data, names), loading: false };
  }, [live, projects.data, row, statuses.data, taskId]);
}

function mapDoc(doc: ConvexDocument): VmDoc {
  return {
    id: doc._id,
    title: doc.title || "Untitled",
    icon: doc.icon ?? null,
    parentId: doc.parentId ?? null,
    isFolder: Boolean(doc.isFolder),
    updatedAt: doc.updatedAt,
    excerpt: doc.isFolder ? "Folder" : excerptOf(doc.content, 90),
    content: doc.content ?? null,
    tone: toneFor(doc._id),
  };
}

export function useDocs(): Result<VmDoc[]> {
  const { enabled, args } = useScope();
  const rows = useQuery(convexApi.documents.list, args);

  return useMemo(() => {
    if (!enabled) return { data: [], loading: false };
    if (rows === undefined) return { data: [], loading: true };
    return { data: rows.map(mapDoc), loading: false };
  }, [enabled, rows]);
}

export function useDoc(documentId?: string): Result<VmDoc | null> {
  const { live } = useWorkspace();
  const row = useQuery(
    convexApi.documents.get,
    live && documentId ? ({ documentId } as never) : "skip",
  );

  return useMemo(() => {
    if (!live) return { data: null, loading: false };
    if (row === undefined) return { data: null, loading: true };
    return { data: row ? mapDoc(row) : null, loading: false };
  }, [documentId, live, row]);
}

export function useEvents(day: number): Result<VmEvent[]> {
  const { live, workspaceId } = useWorkspace();
  const start = startOfDay(day);
  const end = start + 86_400_000;
  const rows = useQuery(
    convexApi.events.listExpanded,
    live && workspaceId ? ({ workspaceId, start, end } as never) : "skip",
  );

  return useMemo(() => {
    if (!live || !workspaceId) {
      return { data: [], loading: false };
    }
    if (rows === undefined) return { data: [], loading: true };
    return {
      data: rows.map((e) => ({
        id: e._id,
        title: e.title,
        meta: e.description ?? "",
        start: e.start,
        end: e.end ?? e.start + 3_600_000,
        tone: e.color ?? toneFor(e._id),
      })),
      loading: false,
    };
  }, [live, rows, start, workspaceId]);
}

export function useNotifications(): Result<VmNotification[]> {
  const { live } = useWorkspace();
  const rows = useQuery(convexApi.notifications.listMine, live ? ({ limit: 40 } as never) : "skip");

  return useMemo(() => {
    if (!live) return { data: [], loading: false };
    if (rows === undefined) return { data: [], loading: true };
    return {
      data: rows.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message ?? n.body ?? "",
        read: n.read,
        createdAt: n.createdAt,
      })),
      loading: false,
    };
  }, [live, rows]);
}

export function useHeatmap(): Result<{ counts: Record<string, number>; total: number }> {
  const { live, workspaceId } = useWorkspace();
  const rows = useQuery(
    convexApi.activities.heatmap,
    live && workspaceId ? ({ workspaceId, days: 133 } as never) : "skip",
  );

  return useMemo(() => {
    if (!live || !workspaceId) {
      return { data: { counts: {}, total: 0 }, loading: false };
    }
    if (rows === undefined) return { data: { counts: {}, total: 0 }, loading: true };
    return { data: rows, loading: false };
  }, [live, rows, workspaceId]);
}

/** Write path. When not signed in, every mutation resolves to `false` so
 * callers can surface a "sign in to edit" toast instead of failing silently. */
export function useActions() {
  const { live, workspaceId } = useWorkspace();
  const setStatus = useMutation(convexApi.tasks.setStatus);
  const createTask = useMutation(convexApi.tasks.create);
  const updateDoc = useMutation(convexApi.documents.update);
  const createDoc = useMutation(convexApi.documents.create);
  const markAllRead = useMutation(convexApi.notifications.markAllRead);

  const toggleTaskStatus = useCallback(
    async (taskId: string, nextStatus: string) => {
      if (!live) return false;
      await setStatus({ taskId, status: nextStatus } as never);
      return true;
    },
    [live, setStatus],
  );

  const addTask = useCallback(
    async (title: string, extras: { dueDate?: number; priority?: string; projectId?: string } = {}) => {
      if (!live || !workspaceId) return null;
      return (await createTask({ workspaceId, title, ...extras } as never)) as string;
    },
    [createTask, live, workspaceId],
  );

  const saveDocument = useCallback(
    async (documentId: string, patch: { title?: string; content?: string }) => {
      if (!live) return false;
      await updateDoc({ documentId, ...patch } as never);
      return true;
    },
    [live, updateDoc],
  );

  const addDocument = useCallback(
    async (title: string, parentId?: string) => {
      if (!live || !workspaceId) return null;
      return (await createDoc({ workspaceId, title, parentId } as never)) as string;
    },
    [createDoc, live, workspaceId],
  );

  const readAllNotifications = useCallback(async () => {
    if (!live) return false;
    await markAllRead({} as never);
    return true;
  }, [live, markAllRead]);

  return { live, toggleTaskStatus, addTask, saveDocument, addDocument, readAllNotifications };
}

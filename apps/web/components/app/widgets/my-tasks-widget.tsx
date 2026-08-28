"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/hooks/use-flux-workspace";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { TaskSquare, TickCircle } from "iconsax-reactjs";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PRIORITY_COLOR: Record<string, string> = {
  none: "var(--muted-foreground)",
  low: "#2f7ea6",
  medium: "#d98324",
  high: "#e5484d",
  urgent: "#E14B3D",
};

function fmtDue(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * My Tasks widget (§3): compact list of tasks assigned to the current user
 * that are due this week (or overdue), reusing `flux_tasks.listMine` +
 * `flux_taskStatuses.list` + `flux_tasks.setStatus`. Checking the circle
 * toggles the task between its first done-status and "todo" (inline check-off).
 */
export function MyTasksWidget() {
  const router = useRouter();
  const t = useTranslations("tasks");
  const tWidget = useTranslations("widgets");
  const { activeWorkspaceId, me } = useWorkspace();

  const tasks = useQuery(
    api.flux_tasks.listMine,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );
  const statuses = useQuery(
    api.flux_taskStatuses.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  ) as
    | { key: string; isDone?: boolean; color?: string }[]
    | undefined;
  const setStatus = useMutation(api.flux_tasks.setStatus);

  const doneKey = (statuses ?? []).find((s) => s.isDone)?.key ?? "done";
  const doneSet = new Set(
    (statuses ?? []).filter((s) => s.isDone).map((s) => s.key),
  );
  if (!doneSet.size) doneSet.add("done");

  const now = Date.now();
  const weekAhead = now + WEEK_MS;

  const mine = (tasks ?? [])
    .filter((task: any) => {
      if (task.assigneeId !== (me?._id ?? me?.id)) return false;
      const isDone = doneSet.has(task.status);
      if (isDone) return false;
      // Due this week, overdue, or undated active tasks.
      if (!task.dueDate) return true;
      return task.dueDate <= weekAhead;
    })
    .sort((a: any, b: any) => {
      const da = a.dueDate ?? Infinity;
      const db = b.dueDate ?? Infinity;
      if (da !== db) return da - db;
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    })
    .slice(0, 30);

  const loading = tasks === undefined || statuses === undefined;

  const toggle = (task: any) => {
    const isDone = doneSet.has(task.status);
    setStatus({ taskId: task._id, status: isDone ? "todo" : doneKey }).catch(() => {});
  };

  if (loading) {
    return (
      <div data-testid="widget-my-tasks" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (mine.length === 0) {
    return (
      <div
        data-testid="widget-my-tasks-empty"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <TickCircle variant="Bulk" size={32} className="opacity-40 text-muted-foreground" />
        <p className="text-sm font-medium">{tWidget("myTasksEmpty")}</p>
        <p className="text-xs text-muted-foreground">{tWidget("myTasksEmptyHint")}</p>
      </div>
    );
  }

  return (
    <div data-testid="widget-my-tasks" className="min-h-0 flex-1 overflow-y-auto">
      {mine.map((task: any) => {
        const isDone = doneSet.has(task.status);
        const overdue = !!task.dueDate && task.dueDate < now && !isDone;
        const pcolor = PRIORITY_COLOR[task.priority ?? "none"] ?? PRIORITY_COLOR.none;
        return (
          <div
            key={task._id}
            data-testid="widget-my-tasks-item"
            className="group flex items-center gap-2.5 border-b border-sidebar-border px-3 py-2 last:border-0"
          >
            <button
              onClick={() => toggle(task)}
              data-testid="widget-my-tasks-check"
              aria-label={isDone ? t("done") : t("bulkMarkDone")}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isDone
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-transparent hover:border-primary",
              )}
            >
              <TickCircle variant="Bold" size={12} />
            </button>
            <button
              onClick={() => router.push("/app/tasks")}
              className="min-w-0 flex-1 text-left"
            >
              <p
                className={cn(
                  "truncate text-sm",
                  isDone ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2">
                {task.dueDate && (
                  <span
                    className={cn(
                      "text-[11px]",
                      overdue ? "font-medium text-primary" : "text-muted-foreground",
                    )}
                  >
                    {fmtDue(task.dueDate)}
                  </span>
                )}
                {task.priority && task.priority !== "none" && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: pcolor }}
                    title={task.priority}
                  />
                )}
              </div>
            </button>
          </div>
        );
      })}
      <button
        onClick={() => router.push("/app/tasks")}
        data-testid="widget-my-tasks-open-all"
        className="flex w-full items-center justify-center gap-1.5 border-t border-sidebar-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <TaskSquare variant="Bulk" size={14} /> {t("title")}
      </button>
    </div>
  );
}

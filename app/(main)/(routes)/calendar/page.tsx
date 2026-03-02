"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List } from "lucide-react";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { useTranslations, useLocale } from "next-intl";

const PRIORITY_DOT: Record<string, string> = {
  none: "bg-slate-400",
  low: "bg-sky-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-amber-500",
  done: "bg-emerald-500",
  cancelled: "bg-red-400",
};

export default function CalendarPage() {
  const t = useTranslations("tasks");
  const tc = useTranslations("calendar");  
  const locale = useLocale();
  const router = useRouter();
  const tasks = useQuery(api.tasks.getMyTasks, {});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewTask, setShowNewTask] = useState(false);
  const [view, setView] = useState<"month" | "agenda">("month");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const tasksByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (tasks ?? []).forEach((task) => {
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    });
    return map;
  }, [tasks]);

  const getTasksForDay = (day: number) => {
    return tasksByDate[`${year}-${month}-${day}`] ?? [];
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  const isOverdue = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(23, 59, 59);
    return d < today;
  };

  const monthLabel = firstDay.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const upcomingTasks = useMemo(() => {
    return (tasks ?? [])
      .filter((t) => t.dueDate && t.status !== "done" && t.status !== "cancelled")
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
  }, [tasks]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const agendaGrouped = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    upcomingTasks.forEach((task) => {
      const d = new Date(task.dueDate!);
      const key = d.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [upcomingTasks]);

  const tasksWithDates = (tasks ?? []).filter((t) => t.dueDate).length;
  const overdueCount = upcomingTasks.filter(
    (t) => t.dueDate! < Date.now(),
  ).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight capitalize">
              {monthLabel}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {tasksWithDates} {tc("scheduled")}
              {overdueCount > 0 && (
                <span className="ml-2 text-red-500 font-medium">
                  · {overdueCount} {tc("overdue")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-lg border p-0.5">
              <button
                onClick={() => setView("month")}
                className={cn(
                  "rounded-md p-1.5 transition-all",
                  view === "month"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("agenda")}
                className={cn(
                  "rounded-md p-1.5 transition-all",
                  view === "agenda"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              onClick={() => setShowNewTask(true)}
              size="sm"
              className="gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newTask")}
            </Button>
          </div>
        </div>

        {view === "month" ? (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
              >
                {tc("today")}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {Array.from({ length: 7 }, (_, i) =>
                new Date(2023, 0, i + 1).toLocaleDateString(locale, { weekday: "short" })
              ).map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-l border-t rounded-xl overflow-hidden">
              {cells.map((day, idx) => {
                const dayTasks = day ? getTasksForDay(day) : [];
                const hasDone = dayTasks.some((t) => t.status === "done");
                const hasOverdue =
                  day &&
                  isOverdue(day) &&
                  dayTasks.some(
                    (t) => t.status !== "done" && t.status !== "cancelled",
                  );

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[96px] border-r border-b p-1.5 transition-colors",
                      day ? "hover:bg-accent/20" : "bg-muted/10",
                      isToday(day ?? 0) && day && "bg-primary/5",
                      hasOverdue && "bg-red-500/3",
                    )}
                  >
                    {day && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                              isToday(day)
                                ? "bg-primary text-primary-foreground font-bold"
                                : hasOverdue
                                  ? "text-red-500 font-semibold"
                                  : "text-foreground",
                            )}
                          >
                            {day}
                          </span>
                          {dayTasks.length > 0 && (
                            <span className="text-[9px] text-muted-foreground/60">
                              {dayTasks.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task._id}
                              onClick={() =>
                                router.push(`/tasks/${task._id}`)
                              }
                              title={task.title}
                              className={cn(
                                "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer transition-opacity hover:opacity-80",
                                task.status === "done"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 line-through opacity-50"
                                  : task.dueDate! < Date.now()
                                    ? "bg-red-500/10 text-red-600"
                                    : "bg-primary/8 text-primary",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full shrink-0",
                                  PRIORITY_DOT[task.priority] ?? "bg-slate-400",
                                )}
                              />
                              <span className="truncate">{task.title}</span>
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[10px] text-muted-foreground/50 px-1">
                              +{dayTasks.length - 3}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary/60" />
                {tc("upcoming")}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500/60" />
                {tc("late")}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500/60" />
                {tc("done")}
              </div>
            </div>
          </>
        ) : (
          /* Agenda view */
          <div>
            {Object.keys(agendaGrouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {tc("noTasks")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {tc("noTasksDesc")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewTask(true)}
                  className="mt-4 gap-1.5 h-7 text-xs"
                >
                  <Plus className="h-3 w-3" /> {t("newTask")}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(agendaGrouped).map(([dateLabel, dateTasks]) => (
                  <section key={dateLabel}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {dateLabel}
                    </h3>
                    <div className="space-y-1.5">
                      {dateTasks.map((task) => (
                        <div
                          key={task._id}
                          onClick={() => router.push(`/tasks/${task._id}`)}
                          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all group"
                        >
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              STATUS_DOT[task.status] ?? "bg-slate-400",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {task.dueDate! < Date.now() && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] bg-red-500/10 text-red-600 border-0"
                              >
                                {tc("late")}
                              </Badge>
                            )}
                            {task.priority !== "none" && (
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  PRIORITY_DOT[task.priority],
                                )}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <NewTaskDialog open={showNewTask} onClose={() => setShowNewTask(false)} />
    </div>
  );
}

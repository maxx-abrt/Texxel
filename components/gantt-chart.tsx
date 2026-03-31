"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

interface GanttTask {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: number;
  createdAt: number;
  assigneeName?: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  projectDueDate?: number;
  projectColor?: string;
}

const STATUS_DOTS: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-amber-500",
  done: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  none: "bg-slate-300 dark:bg-slate-600",
  low: "bg-sky-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const DAY_MS = 86_400_000;

type TimeScale = "week" | "month" | "quarter";

export function GanttChart({ tasks, projectDueDate, projectColor = "#6366f1" }: GanttChartProps) {
  const t = useTranslations("projects.gantt");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<TimeScale>("month");
  const [offset, setOffset] = useState(0);

  const tasksWithDates = useMemo(
    () => tasks.filter((t) => t.dueDate).sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)),
    [tasks],
  );

  if (tasksWithDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t("noTasks")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{t("noTasksDesc")}</p>
      </div>
    );
  }

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const scaleConfig = {
    week: { days: 28, cellDays: 1, label: t("week") },
    month: { days: 60, cellDays: 2, label: t("month") },
    quarter: { days: 120, cellDays: 7, label: t("quarter") },
  };
  const cfg = scaleConfig[scale];

  const startDate = new Date(todayMs + offset * DAY_MS);
  startDate.setHours(0, 0, 0, 0);
  const startMs = startDate.getTime();
  const endMs = startMs + cfg.days * DAY_MS;

  const totalCols = Math.ceil(cfg.days / cfg.cellDays);
  const colWidth = scale === "week" ? 40 : scale === "month" ? 28 : 20;
  const totalWidth = totalCols * colWidth;

  const todayCol = Math.floor((todayMs - startMs) / (cfg.cellDays * DAY_MS));

  const getDateHeaders = () => {
    const headers: { label: string; cols: number }[] = [];
    let d = new Date(startMs);
    while (d.getTime() < endMs) {
      const monthLabel = d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
      let cols = 0;
      const currentMonth = d.getMonth();
      while (d.getMonth() === currentMonth && d.getTime() < endMs) {
        d = new Date(d.getTime() + cfg.cellDays * DAY_MS);
        cols++;
      }
      headers.push({ label: monthLabel, cols });
    }
    return headers;
  };

  const getSubHeaders = () => {
    const subs: string[] = [];
    for (let i = 0; i < totalCols; i++) {
      const d = new Date(startMs + i * cfg.cellDays * DAY_MS);
      if (scale === "week") subs.push(d.getDate().toString());
      else if (scale === "month") subs.push(d.getDate().toString());
      else subs.push(`W${Math.ceil(d.getDate() / 7)}`);
    }
    return subs;
  };

  const dateHeaders = getDateHeaders();
  const subHeaders = getSubHeaders();

  const getBarPosition = (task: GanttTask) => {
    const taskStart = task.createdAt;
    const taskEnd = task.dueDate!;
    const barStartCol = Math.max(0, Math.floor((taskStart - startMs) / (cfg.cellDays * DAY_MS)));
    const barEndCol = Math.min(totalCols, Math.ceil((taskEnd - startMs) / (cfg.cellDays * DAY_MS)));
    if (barEndCol <= 0 || barStartCol >= totalCols) return null;
    return { left: barStartCol * colWidth, width: Math.max(colWidth, (barEndCol - barStartCol) * colWidth) };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <div className="flex gap-0.5 rounded-lg border p-0.5">
          {(["week", "month", "quarter"] as TimeScale[]).map((s) => (
            <button
              key={s}
              onClick={() => { setScale(s); setOffset(0); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                scale === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {scaleConfig[s].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - cfg.days / 2)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {t("today")}
          </button>
          <button
            onClick={() => setOffset((o) => o + cfg.days / 2)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {tasksWithDates.length} {tasksWithDates.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Chart */}
      <div className="flex flex-1 overflow-hidden">
        {/* Task names sidebar */}
        <div className="shrink-0 w-48 border-r overflow-y-auto">
          <div className="h-[52px] border-b flex items-end px-3 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {tasksWithDates.length} tasks
            </span>
          </div>
          {tasksWithDates.map((task) => (
            <div
              key={task._id}
              className="flex items-center gap-2 h-9 px-3 border-b border-border/40 hover:bg-accent/30 transition-colors"
            >
              <div className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOTS[task.status] ?? STATUS_DOTS.todo)} />
              <span className="text-xs truncate">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Month headers */}
            <div className="flex h-6 border-b sticky top-0 bg-background z-10">
              {dateHeaders.map((h, i) => (
                <div
                  key={i}
                  className="border-r border-border/40 text-center text-[10px] font-semibold text-muted-foreground flex items-center justify-center"
                  style={{ width: h.cols * colWidth }}
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* Day/week sub-headers */}
            <div className="flex h-[26px] border-b sticky top-6 bg-background z-10">
              {subHeaders.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    "border-r border-border/20 text-center text-[9px] text-muted-foreground/50 flex items-center justify-center",
                    i === todayCol && "bg-primary/10 text-primary font-bold",
                  )}
                  style={{ width: colWidth }}
                >
                  {s}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today line */}
              {todayCol >= 0 && todayCol < totalCols && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/40 z-20"
                  style={{ left: todayCol * colWidth + colWidth / 2 }}
                />
              )}

              {/* Project deadline line */}
              {projectDueDate && (() => {
                const deadlineCol = Math.floor((projectDueDate - startMs) / (cfg.cellDays * DAY_MS));
                if (deadlineCol < 0 || deadlineCol >= totalCols) return null;
                return (
                  <div
                    className="absolute top-0 bottom-0 w-px z-20"
                    style={{ left: deadlineCol * colWidth + colWidth / 2, backgroundColor: projectColor, opacity: 0.5 }}
                  />
                );
              })()}

              {/* Grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {Array.from({ length: totalCols }).map((_, i) => (
                  <div key={i} className="border-r border-border/10 shrink-0" style={{ width: colWidth, height: "100%" }} />
                ))}
              </div>

              {/* Task bars */}
              {tasksWithDates.map((task) => {
                const pos = getBarPosition(task);
                return (
                  <div key={task._id} className="relative h-9 border-b border-border/20">
                    {pos && (
                      <div
                        className={cn(
                          "absolute top-1.5 h-6 rounded-md flex items-center px-2 text-[10px] font-medium text-white truncate shadow-sm transition-all hover:shadow-md cursor-pointer",
                          task.status === "done" && "opacity-60",
                        )}
                        style={{
                          left: pos.left,
                          width: pos.width,
                          backgroundColor: task.status === "done" ? "#22c55e" : task.priority === "urgent" ? "#ef4444" : task.priority === "high" ? "#f97316" : projectColor,
                        }}
                        title={`${task.title} — ${new Date(task.dueDate!).toLocaleDateString(locale)}`}
                      >
                        {pos.width > 60 && task.title}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

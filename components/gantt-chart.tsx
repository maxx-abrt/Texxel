"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { Calendar, ChevronLeft, ChevronRight, Flag, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter } from "next/navigation";

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

const STATUS_BAR_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  in_review: "#f59e0b",
  done: "#22c55e",
  cancelled: "#ef4444",
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "ring-2 ring-red-400/60",
  high: "ring-2 ring-orange-400/40",
  medium: "",
  low: "",
  none: "",
};

const STATUS_DOTS: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-amber-500",
  done: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const DAY_MS = 86_400_000;
type TimeScale = "week" | "month" | "quarter";

export function GanttChart({ tasks, projectDueDate, projectColor = "#6366f1" }: GanttChartProps) {
  const t = useTranslations("projects.gantt");
  const locale = useLocale();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<TimeScale>("month");
  const [offset, setOffset] = useState(0);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const mounted = useRef(false);

  const tasksWithDates = useMemo(
    () => tasks.filter((t) => t.dueDate).sort((a, b) => (a.createdAt) - (b.createdAt)),
    [tasks],
  );

  const scaleConfig = {
    week: { days: 28, cellDays: 1, label: t("week"), colW: 42 },
    month: { days: 60, cellDays: 2, label: t("month"), colW: 30 },
    quarter: { days: 120, cellDays: 7, label: t("quarter"), colW: 22 },
  };
  const cfg = scaleConfig[scale];
  const colWidth = cfg.colW;

  const todayMs = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const startMs = todayMs + offset * DAY_MS;
  const endMs = startMs + cfg.days * DAY_MS;
  const totalCols = Math.ceil(cfg.days / cfg.cellDays);
  const totalWidth = totalCols * colWidth;
  const todayCol = Math.floor((todayMs - startMs) / (cfg.cellDays * DAY_MS));

  // Scroll to today on mount
  useEffect(() => {
    if (mounted.current || !scrollRef.current) return;
    mounted.current = true;
    const todayPx = todayCol * colWidth;
    if (todayPx > 0) scrollRef.current.scrollLeft = Math.max(0, todayPx - 120);
  }, [todayCol, colWidth]);

  if (tasksWithDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Calendar className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t("noTasks")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">{t("noTasksDesc")}</p>
      </div>
    );
  }

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
    const subs: { label: string; isWeekend: boolean }[] = [];
    for (let i = 0; i < totalCols; i++) {
      const d = new Date(startMs + i * cfg.cellDays * DAY_MS);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (scale === "quarter") subs.push({ label: `W${Math.ceil(d.getDate() / 7)}`, isWeekend: false });
      else subs.push({ label: d.getDate().toString(), isWeekend });
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

  const getBarColor = (task: GanttTask) => STATUS_BAR_COLORS[task.status] ?? projectColor;

  const navStep = Math.max(7, Math.floor(cfg.days / 3));

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b shrink-0 bg-background/95 backdrop-blur-sm">
        <div className="flex gap-0.5 rounded-lg border p-0.5">
          {(["week", "month", "quarter"] as TimeScale[]).map((s) => (
            <button
              key={s}
              onClick={() => { setScale(s); setOffset(0); mounted.current = false; }}
              className={cn(
                "rounded-md px-2 sm:px-2.5 py-1 text-[11px] font-medium transition-all",
                scale === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {scaleConfig[s].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
          <button onClick={() => setOffset((o) => o - navStep)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setOffset(0); mounted.current = false; }} className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            {t("today")}
          </button>
          <button onClick={() => setOffset((o) => o + navStep)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {tasksWithDates.length} task{tasksWithDates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Task names sidebar — hidden on very small screens */}
        <div className="hidden sm:block shrink-0 w-44 lg:w-52 border-r overflow-y-auto bg-background">
          <div className="h-[52px] border-b flex items-end px-3 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              {tasksWithDates.length} task{tasksWithDates.length !== 1 ? "s" : ""}
            </span>
          </div>
          {tasksWithDates.map((task) => (
            <div
              key={task._id}
              onClick={() => router.push(`/tasks/${task._id}`)}
              onMouseEnter={() => setHoveredTask(task._id)}
              onMouseLeave={() => setHoveredTask(null)}
              className={cn(
                "flex items-center gap-2 h-10 px-3 border-b border-border/30 cursor-pointer transition-colors",
                hoveredTask === task._id ? "bg-accent/40" : "hover:bg-accent/20",
              )}
            >
              <div className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOTS[task.status] ?? STATUS_DOTS.todo)} />
              <div className="flex-1 min-w-0">
                <span className={cn("text-xs truncate block", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</span>
                {task.assigneeName && <span className="text-[9px] text-muted-foreground/50 truncate block">{task.assigneeName}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scroll-smooth">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Month headers */}
            <div className="flex h-6 border-b sticky top-0 bg-background z-10">
              {dateHeaders.map((h, i) => (
                <div key={i} className="border-r border-border/30 text-center text-[10px] font-semibold text-muted-foreground/70 flex items-center justify-center" style={{ width: h.cols * colWidth }}>
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
                    "border-r border-border/15 text-center text-[9px] flex items-center justify-center transition-colors",
                    i === todayCol ? "bg-primary/10 text-primary font-bold" : s.isWeekend ? "bg-muted/30 text-muted-foreground/30" : "text-muted-foreground/40",
                  )}
                  style={{ width: colWidth }}
                >
                  {s.label}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Weekend columns */}
              {scale !== "quarter" && (
                <div className="absolute inset-0 flex pointer-events-none">
                  {subHeaders.map((s, i) => (
                    s.isWeekend ? <div key={i} className="bg-muted/15 shrink-0" style={{ width: colWidth, height: "100%" }} /> : <div key={i} className="shrink-0" style={{ width: colWidth }} />
                  ))}
                </div>
              )}

              {/* Today line */}
              {todayCol >= 0 && todayCol < totalCols && (
                <div className="absolute top-0 bottom-0 z-20 flex flex-col items-center" style={{ left: todayCol * colWidth + colWidth / 2 - 0.5 }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary -mt-px" />
                  <div className="w-px flex-1 bg-primary/40" />
                </div>
              )}

              {/* Project deadline line */}
              {projectDueDate && (() => {
                const deadlineCol = Math.floor((projectDueDate - startMs) / (cfg.cellDays * DAY_MS));
                if (deadlineCol < 0 || deadlineCol >= totalCols) return null;
                return (
                  <div className="absolute top-0 bottom-0 z-20 flex flex-col items-center" style={{ left: deadlineCol * colWidth + colWidth / 2 - 0.5 }}>
                    <Flag className="h-3 w-3 -mt-0.5 shrink-0" style={{ color: projectColor }} />
                    <div className="w-px flex-1" style={{ backgroundColor: projectColor, opacity: 0.4 }} />
                  </div>
                );
              })()}

              {/* Grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {Array.from({ length: totalCols }).map((_, i) => (
                  <div key={i} className="border-r border-border/8 shrink-0" style={{ width: colWidth, height: "100%" }} />
                ))}
              </div>

              {/* Task bars */}
              {tasksWithDates.map((task) => {
                const pos = getBarPosition(task);
                const barColor = getBarColor(task);
                const isHovered = hoveredTask === task._id;
                const isOverdue = task.dueDate! < todayMs && task.status !== "done";
                return (
                  <div
                    key={task._id}
                    className={cn("relative h-10 border-b border-border/15 transition-colors", isHovered && "bg-accent/20")}
                    onMouseEnter={() => setHoveredTask(task._id)}
                    onMouseLeave={() => setHoveredTask(null)}
                  >
                    {pos && (
                      <div className="group/bar absolute top-2" style={{ left: pos.left, width: pos.width }}>
                        <div
                          onClick={() => router.push(`/tasks/${task._id}`)}
                          className={cn(
                            "h-6 rounded-full flex items-center gap-1.5 px-2.5 text-[10px] font-medium text-white truncate cursor-pointer transition-all",
                            "shadow-sm hover:shadow-md hover:brightness-110",
                            task.status === "done" && "opacity-55",
                            isOverdue && "animate-pulse",
                            PRIORITY_BORDER[task.priority] ?? "",
                          )}
                          style={{ backgroundColor: barColor }}
                        >
                          {pos.width > 80 && task.title}
                          {pos.width > 40 && pos.width <= 80 && task.assigneeName && (
                            <span className="text-white/70 font-bold">{task.assigneeName[0]}</span>
                          )}
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-30">
                          <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-[11px] whitespace-nowrap">
                            <p className="font-semibold mb-0.5">{task.title}</p>
                            <p className="text-muted-foreground">
                              {new Date(task.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                              {" → "}
                              {new Date(task.dueDate!).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                            </p>
                            {task.assigneeName && <p className="text-muted-foreground/70 mt-0.5">{task.assigneeName}</p>}
                          </div>
                        </div>
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

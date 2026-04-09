"use client";

import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { AlertCircle, Calendar, CheckCircle2, Circle, Clock, CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  none:   { label: "None",   color: "text-slate-400",                bg: "bg-slate-100 dark:bg-slate-800/50",       border: "border-l-slate-200 dark:border-l-slate-700",   dot: "bg-slate-300 dark:bg-slate-600" },
  low:    { label: "Low",    color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-900/20",            border: "border-l-sky-300 dark:border-l-sky-700",       dot: "bg-sky-400" },
  medium: { label: "Medium", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20",   border: "border-l-amber-300 dark:border-l-amber-700",   dot: "bg-amber-400" },
  high:   { label: "High",   color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-l-orange-400 dark:border-l-orange-700", dot: "bg-orange-500" },
  urgent: { label: "Critical", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20",         border: "border-l-red-400 dark:border-l-red-600",       dot: "bg-red-500" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: "To Do",       color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800/60" },
  in_progress: { label: "In Progress", color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  in_review:   { label: "In Review",   color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  done:        { label: "Done",        color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  cancelled:   { label: "Cancelled",   color: "text-red-400",     bg: "bg-red-50 dark:bg-red-900/20" },
};

const LABEL_PALETTES = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400",
];

function labelPalette(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) & 0xffff;
  return LABEL_PALETTES[h % LABEL_PALETTES.length];
}

function formatDue(ts: number) {
  const now = Date.now();
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const todayEnd = todayStart + 86_400_000;
  if (ts >= todayStart && ts < todayEnd) return { label: "Today", overdue: false, today: true, soon: false };
  if (ts < now) {
    const days = Math.ceil((now - ts) / 86_400_000);
    return { label: days === 1 ? "Yesterday" : `${days}d ago`, overdue: true, today: false, soon: false };
  }
  const soon = ts - now < 3 * 86_400_000;
  return {
    label: new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    overdue: false, today: false, soon,
  };
}

export interface Task {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: number;
  labels?: string[];
  assigneeId?: string;
  assigneeName?: string;
  assigneeImage?: string;
  estimateMinutes?: number;
  subtaskCount?: number;
  completedSubtasks?: number;
}

interface TaskCardProps {
  task: Task;
  onToggleDone: (id: Id<"tasks">, current: string) => void;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (id: Id<"tasks">, checked: boolean) => void;
  showStatus?: boolean;
  /** When true, renders as a rich kanban card (description, all meta) */
  kanban?: boolean;
}

export function TaskCard({ task, onToggleDone, compact, selected, onSelect, showStatus, kanban }: TaskCardProps) {
  const router = useRouter();
  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
  const dueInfo = task.dueDate ? formatDue(task.dueDate) : null;
  const hasSubtasks = (task.subtaskCount ?? 0) > 0;

  /* ── Kanban card (rich, screenshot-style) ────────────────────────── */
  if (kanban) {
    return (
      <div
        className={cn(
          "group relative rounded-xl border border-l-[3px] bg-card shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer overflow-hidden",
          "px-3.5 pt-3 pb-2.5",
          isDone || isCancelled ? "opacity-60" : "",
          pCfg.border,
          selected && "ring-2 ring-primary/30",
        )}
        onClick={() => router.push(`/tasks/${task._id}`)}
      >
        {/* Title */}
        <p className={cn(
          "text-[13.5px] font-semibold leading-snug mb-1",
          isDone && "line-through text-muted-foreground/60",
          isCancelled && "line-through text-muted-foreground/40",
        )}>
          {task.title}
        </p>

        {/* Description snippet */}
        {task.description && (
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed line-clamp-2 mb-2.5">
            {task.description}
          </p>
        )}

        {/* Date + subtasks row */}
        {(dueInfo || hasSubtasks) && (
          <div className="flex items-center gap-2 mb-2">
            {dueInfo && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border",
                dueInfo.overdue
                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50"
                  : dueInfo.today
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                  : "bg-muted/60 text-muted-foreground border-border/40",
              )}>
                <Calendar className="h-3 w-3 shrink-0" />
                {dueInfo.label}
              </span>
            )}
            {hasSubtasks && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
                <CheckSquare className="h-3 w-3 shrink-0" />
                {task.completedSubtasks ?? 0}/{task.subtaskCount}
              </span>
            )}
            {task.estimateMinutes && task.estimateMinutes > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 ml-auto">
                <Clock className="h-3 w-3 shrink-0" />
                {task.estimateMinutes >= 60
                  ? `${Math.floor(task.estimateMinutes / 60)}h${task.estimateMinutes % 60 ? `${task.estimateMinutes % 60}m` : ""}`
                  : `${task.estimateMinutes}m`}
              </span>
            )}
          </div>
        )}

        {/* Labels */}
        {(task.labels?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels!.slice(0, 3).map((label) => (
              <span key={label} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", labelPalette(label))}>
                {label}
              </span>
            ))}
            {task.labels!.length > 3 && (
              <span className="text-[10px] text-muted-foreground/50">+{task.labels!.length - 3}</span>
            )}
          </div>
        )}

        {/* Bottom row: priority + assignee */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
          <div className="flex items-center gap-2">
            {task.priority !== "none" && (
              <span className={cn("text-[11px] font-medium", pCfg.color)}>
                Priority: {pCfg.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.assigneeId && (
              <span className="text-[11px] text-muted-foreground/60">
                {task.assigneeImage ? (
                  <img src={task.assigneeImage} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-border inline-block" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-primary/20">
                    {task.assigneeName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </span>
            )}
            {!task.assigneeId && task.estimateMinutes && task.estimateMinutes > 0 && !dueInfo && (
              <span className="text-[11px] text-muted-foreground/60">
                Estimated Hours: {Math.round(task.estimateMinutes / 60 * 10) / 10}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Standard list card ──────────────────────────────────────────── */
  return (
    <div
      className={cn(
        "group relative flex items-start gap-2.5 rounded-xl border border-l-2 bg-card transition-all duration-150 hover:shadow-sm cursor-pointer",
        compact ? "px-3 py-2" : "px-3.5 py-2.5",
        isDone || isCancelled ? "opacity-50" : "hover:border-border",
        task.priority !== "none" ? pCfg.border : "border-l-border/40",
        selected && "ring-2 ring-primary/30 border-primary/40",
      )}
      onClick={() => router.push(`/tasks/${task._id}`)}
    >
      {onSelect && (
        <div
          className={cn(
            "absolute -left-5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded border transition-all",
            selected ? "bg-primary border-primary opacity-100" : "border-border/50 opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => { e.stopPropagation(); onSelect(task._id, !selected); }}
        >
          {selected && <span className="text-[8px] text-white font-bold">✓</span>}
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onToggleDone(task._id, task.status); }}
        className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-foreground transition-colors duration-150"
      >
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className={cn("h-4 w-4", task.priority === "urgent" && "text-red-400/50")} />
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {task.priority !== "none" && (
            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-0.5", pCfg.dot)} />
          )}
          <span className={cn(
            "flex-1 text-[13px] font-medium leading-snug truncate",
            isDone && "line-through text-muted-foreground/60",
            isCancelled && "line-through text-muted-foreground/40",
          )}>
            {task.title}
          </span>
        </div>

        {!compact && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {showStatus && !isDone && (
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", sCfg.color, sCfg.bg)}>
                {sCfg.label}
              </span>
            )}
            {dueInfo && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                dueInfo.overdue ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                dueInfo.today   ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                dueInfo.soon    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                                  "bg-muted text-muted-foreground",
              )}>
                {dueInfo.overdue ? <AlertCircle className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                {dueInfo.label}
              </span>
            )}
            {task.estimateMinutes && task.estimateMinutes > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {task.estimateMinutes >= 60
                  ? `${Math.floor(task.estimateMinutes / 60)}h${task.estimateMinutes % 60 ? ` ${task.estimateMinutes % 60}m` : ""}`
                  : `${task.estimateMinutes}m`}
              </span>
            )}
            {task.labels?.slice(0, 3).map((label) => (
              <span key={label} className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", labelPalette(label))}>
                {label}
              </span>
            ))}
            {(task.labels?.length ?? 0) > 3 && (
              <span className="text-[10px] text-muted-foreground/60">+{task.labels!.length - 3}</span>
            )}
            {hasSubtasks && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                  <span className="block h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(((task.completedSubtasks ?? 0) / task.subtaskCount!) * 100)}%` }} />
                </span>
                <span>{task.completedSubtasks ?? 0}/{task.subtaskCount}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {task.assigneeId && (
        <div className="shrink-0 mt-0.5" title={task.assigneeName ?? "Assignee"}>
          {task.assigneeImage ? (
            <img src={task.assigneeImage} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-primary/20">
              {task.assigneeName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

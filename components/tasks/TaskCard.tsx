"use client";

import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { Calendar, CheckCircle2, Circle, Flag } from "lucide-react";
import { useRouter } from "next/navigation";

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  none: { label: "None", color: "text-muted-foreground", dot: "bg-slate-300 dark:bg-slate-600" },
  low: { label: "Low", color: "text-sky-500", dot: "bg-sky-500" },
  medium: { label: "Medium", color: "text-amber-500", dot: "bg-amber-500" },
  high: { label: "High", color: "text-orange-500", dot: "bg-orange-500" },
  urgent: { label: "Urgent", color: "text-red-500", dot: "bg-red-500" },
};

interface Task {
  _id: Id<"tasks">;
  title: string;
  status: string;
  priority: string;
  dueDate?: number;
  labels?: string[];
  assigneeId?: string;
  assigneeName?: string;
  assigneeImage?: string;
}

interface TaskCardProps {
  task: Task;
  onToggleDone: (id: Id<"tasks">, current: string) => void;
  compact?: boolean;
}

export function TaskCard({ task, onToggleDone, compact }: TaskCardProps) {
  const router = useRouter();
  const isDone = task.status === "done";
  const isOverdue = task.dueDate && task.dueDate < Date.now() && !isDone;
  const pCfg = priorityConfig[task.priority] ?? priorityConfig.none;

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border bg-card transition-all hover:border-primary/20 hover:shadow-sm cursor-pointer",
        compact ? "px-3 py-2" : "px-3 py-2.5",
        isDone && "opacity-50",
      )}
      onClick={() => router.push(`/tasks/${task._id}`)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(task._id, task.status);
        }}
        className="shrink-0 text-muted-foreground/50 hover:text-primary transition-colors"
      >
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Priority indicator */}
      {task.priority !== "none" && (
        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", pCfg.dot)} />
      )}

      <span className={cn(
        "flex-1 text-sm truncate",
        isDone && "line-through text-muted-foreground",
      )}>
        {task.title}
      </span>

      {/* Meta - always visible on hover, some always visible */}
      <div className="flex items-center gap-2 shrink-0">
        {task.dueDate && (
          <span className={cn(
            "flex items-center gap-1 text-[11px]",
            isOverdue ? "text-red-500 font-medium" : "text-muted-foreground",
          )}>
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}

        {task.labels?.slice(0, 1).map((label) => (
          <span key={label} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {label}
          </span>
        ))}

        {/* Assignee avatar */}
        {task.assigneeId && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary ring-1 ring-primary/20">
            {task.assigneeName?.[0]?.toUpperCase() ?? task.assigneeImage ? (
              <img src={task.assigneeImage} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              task.assigneeName?.[0]?.toUpperCase() ?? "?"
            )}
          </div>
        )}
      </div>
    </div>
  );
}
